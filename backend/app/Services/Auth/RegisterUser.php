<?php

namespace App\Services\Auth;

use App\Models\ConsentLog;
use App\Models\User;
use App\Notifications\AlreadyRegisteredNotification;
use App\Services\AuditLogger;
use App\Support\IpHasher;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;

/**
 * Inscription anti-énumération : le résultat est le même (202, même corps, durée égalisée) que l'adresse soit
 * nouvelle, déjà vérifiée ou non vérifiée. Aucune session n'est ouverte ici.
 * - nouvelle adresse : compte `user` non vérifié + lien de confirmation signé ;
 * - adresse vérifiée : e-mail « vous avez déjà un compte », compte inchangé ;
 * - adresse non vérifiée : nom/mot de passe/téléphone REMPLACÉS (anti pré-détournement) + nouveau lien.
 */
class RegisterUser
{
    public const CONSENT_PURPOSE = 'registration';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly VerificationMailer $mailer,
    ) {}

    /**
     * @param  array{first_name: string, last_name: string, email: string, password: string, phone?: string|null}  $data
     */
    public function handle(Request $request, array $data): void
    {
        $email = Str::lower(trim($data['email']));
        $microseconds = max(0, (int) config('auth.register_timebox_ms', 1000)) * 1000;

        (new Timebox)->call(function () use ($request, $data, $email) {
            try {
                $this->process($request, $data, $email);
            } catch (UniqueConstraintViolationException) {
                // Course entre deux inscriptions simultanées : silencieux, la réponse reste identique.
            }
        }, $microseconds);
    }

    /**
     * @param  array{first_name: string, last_name: string, email: string, password: string, phone?: string|null}  $data
     */
    private function process(Request $request, array $data, string $email): void
    {
        /** @var User|null $existing */
        $existing = User::query()->where('email', $email)->first();

        if ($existing === null) {
            $this->mailer->send($this->create($request, $data, $email));

            return;
        }

        if ($existing->hasVerifiedEmail()) {
            $this->notifyAlreadyRegistered($existing);

            return;
        }

        if ($existing->role !== User::ROLE_USER || ! $existing->is_active) {
            return;
        }

        // Compte non vérifié : les nouvelles données remplacent les anciennes (neutralise la pré-inscription).
        $existing->forceFill([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'password' => $data['password'],
            'phone' => $data['phone'] ?? null,
        ])->save();
        $this->recordConsent($request, $existing);
        $this->audit->record('unverified_registration_replaced', $existing, actor: $existing);
        $this->mailer->send($existing);
    }

    /**
     * @param  array{first_name: string, last_name: string, email: string, password: string, phone?: string|null}  $data
     */
    private function create(Request $request, array $data, string $email): User
    {
        $user = DB::transaction(function () use ($data, $email, $request) {
            $user = new User([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $email,
                'password' => $data['password'],
                'phone' => $data['phone'] ?? null,
            ]);
            // Colonnes sensibles : écrites côté serveur, jamais depuis la requête.
            $user->forceFill(['role' => User::ROLE_USER, 'is_active' => true]);
            $user->save();
            $this->recordConsent($request, $user);

            return $user;
        });

        $user->refresh();
        $this->audit->record('user_registered', $user, actor: $user);

        return $user;
    }

    private function recordConsent(Request $request, User $user): void
    {
        ConsentLog::create([
            'user_id' => $user->getKey(),
            'email' => $user->email,
            'purpose' => self::CONSENT_PURPOSE,
            'policy_version' => (string) config('app.policy_version'),
            'granted' => true,
            'ip_hash' => IpHasher::hash($request->ip()),
        ]);
    }

    private function notifyAlreadyRegistered(User $user): void
    {
        $key = 'verification-mail|'.sha1(mb_strtolower((string) $user->email));
        if (RateLimiter::tooManyAttempts($key, (int) config('auth.verification_mail_per_hour', 3))) {
            return;
        }
        RateLimiter::hit($key, 3600);
        $user->notify(new AlreadyRegisteredNotification);
    }
}
