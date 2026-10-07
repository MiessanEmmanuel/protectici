<?php

namespace App\Services\Auth;

use App\Http\Middleware\StaffSessionInactivity;
use App\Models\ConsentLog;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\IpHasher;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Inscription : rôle TOUJOURS `user`, consentement journalisé (consent_logs), email de vérification,
 * puis ouverture de session (comme Fortify) pour permettre le renvoi du lien de vérification.
 */
class RegisterUser
{
    public const CONSENT_PURPOSE = 'registration';

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{first_name: string, last_name: string, email: string, password: string, phone?: string|null}  $data
     */
    public function handle(Request $request, array $data): User
    {
        $email = Str::lower(trim($data['email']));

        try {
            $user = DB::transaction(function () use ($data, $email, $request) {
                $user = new User([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'email' => $email,
                    'password' => $data['password'],
                    'phone' => $data['phone'] ?? null,
                ]);
                // Colonnes sensibles : écrites explicitement côté serveur, jamais depuis la requête.
                $user->forceFill(['role' => User::ROLE_USER, 'is_active' => true]);
                $user->save();

                ConsentLog::create([
                    'user_id' => $user->getKey(),
                    'email' => $email,
                    'purpose' => self::CONSENT_PURPOSE,
                    'policy_version' => (string) config('app.policy_version'),
                    'granted' => true,
                    'ip_hash' => IpHasher::hash($request->ip()),
                ]);

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            // Course entre deux inscriptions simultanées : même message générique que la validation.
            throw ValidationException::withMessages(['email' => __('auth.register_failed')]);
        }

        $user->refresh();

        $this->audit->record('user_registered', $user, actor: $user);

        $user->sendEmailVerificationNotification();

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put(StaffSessionInactivity::SESSION_KEY, now()->getTimestamp());

        return $user;
    }
}
