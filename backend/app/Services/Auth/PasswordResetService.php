<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Rules\StrongPassword;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;

/**
 * Mot de passe oublié / réinitialisation (broker Laravel, jetons hachés, expiration 60 min).
 * La demande renvoie toujours la même réponse, dans un temps minimal constant (Timebox),
 * et n'envoie rien si le compte n'existe pas ou est désactivé.
 */
class PasswordResetService
{
    public function __construct(
        private readonly SessionInvalidator $sessions,
        private readonly AuditLogger $audit,
    ) {}

    public function sendResetLink(string $email): void
    {
        $email = Str::lower(trim($email));
        $microseconds = max(0, (int) config('auth.forgot_password_timebox_ms', 400)) * 1000;

        (new Timebox)->call(function () use ($email) {
            /** @var User|null $user */
            $user = User::query()->where('email', $email)->first();

            if ($user === null || ! $user->is_active) {
                return;
            }

            // Le statut (envoyé, limité par le broker…) n'est jamais exposé.
            Password::broker()->sendResetLink(['email' => $email]);
        }, $microseconds);
    }

    /**
     * @param  array{token: string, email: string, password: string}  $data
     */
    public function reset(array $data): void
    {
        $status = Password::broker()->reset(
            [
                'email' => Str::lower(trim($data['email'])),
                'token' => $data['token'],
                'password' => $data['password'],
            ],
            function (User $user, #[\SensitiveParameter] string $password) {
                // Règle du rôle (12 pour provider/editor/admin) : le jeton est valide à ce stade,
                // et il n'est pas consommé si la règle échoue.
                Validator::make(['password' => $password], ['password' => [StrongPassword::forUser($user)]])->validate();

                $user->forceFill(['password' => $password])->save();

                // Toutes les sessions et cookies « se souvenir de moi » existants sont invalidés.
                $this->sessions->destroyAll($user);

                $this->audit->record('password_reset', $user, actor: $user);

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            // Message unique pour jeton invalide/expiré et email inconnu.
            throw ValidationException::withMessages(['email' => __('passwords.token')]);
        }
    }
}
