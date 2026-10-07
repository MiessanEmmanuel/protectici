<?php

namespace App\Services\Auth;

use App\Http\Middleware\StaffSessionInactivity;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Connexion (contrat §3) : message d'échec générique et identique (compte inconnu, mauvais mot de passe,
 * compte inactif), temps de réponse égalisé, verrouillage progressif, 2FA en deux étapes.
 */
class AuthenticateUser
{
    /** Durée de validité d'une connexion en attente du code 2FA. */
    public const PENDING_TTL_SECONDS = 300;

    public const TWO_FACTOR_MAX_FAILURES = 5;

    public function __construct(
        private readonly LoginThrottle $throttle,
        private readonly TwoFactorAuthentication $twoFactor,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @return User|null L'utilisateur connecté, ou null si un code 2FA est requis.
     */
    public function login(Request $request, string $email, #[\SensitiveParameter] string $password, bool $remember): ?User
    {
        $email = Str::lower(trim($email));
        $key = $this->throttle->key($email, $request->ip());

        $this->throttle->ensureNotLocked($key);
        $this->throttle->hitStaffLimiter($request);

        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        // Égalisation du temps : une vérification Argon2id est toujours effectuée.
        $passwordValid = Hash::check($password, $user !== null ? $user->password : $this->dummyHash());

        if ($user === null || ! $passwordValid || ! $user->is_active) {
            $this->throttle->recordFailure($key, $user);
            if ($user !== null && $user->isStaff()) {
                $this->audit->record('login_failed', $user, context: ['reason' => 'credentials']);
            }

            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        $this->throttle->clear($key);

        $session = $request->session();

        if ($user->hasTwoFactorEnabled()) {
            $session->regenerate();
            $session->put([
                TwoFactorAuthentication::SESSION_PENDING_ID => $user->getKey(),
                TwoFactorAuthentication::SESSION_PENDING_REMEMBER => $remember,
                TwoFactorAuthentication::SESSION_PENDING_AT => now()->getTimestamp(),
                TwoFactorAuthentication::SESSION_FAILURES => 0,
            ]);

            return null;
        }

        return $this->completeLogin($request, $user, $remember, ['two_factor' => false]);
    }

    /**
     * Deuxième étape : code TOTP ou code de secours.
     */
    public function challenge(Request $request, ?string $code, ?string $recoveryCode): User
    {
        $session = $request->session();
        $field = $code !== null ? 'code' : 'recovery_code';

        $userId = $session->get(TwoFactorAuthentication::SESSION_PENDING_ID);
        $pendingAt = (int) $session->get(TwoFactorAuthentication::SESSION_PENDING_AT, 0);

        /** @var User|null $user */
        $user = $userId !== null ? User::query()->find($userId) : null;

        if ($user === null || ! $user->is_active || ! $user->hasTwoFactorEnabled()
            || now()->getTimestamp() - $pendingAt > self::PENDING_TTL_SECONDS) {
            $this->forgetPending($request);

            throw ValidationException::withMessages([$field => __('auth.two_factor_expired')]);
        }

        $valid = $code !== null
            ? $this->twoFactor->verifyCode($user, $code)
            : $this->twoFactor->useRecoveryCode($user, (string) $recoveryCode);

        if (! $valid) {
            $failures = (int) $session->get(TwoFactorAuthentication::SESSION_FAILURES, 0) + 1;
            $session->put(TwoFactorAuthentication::SESSION_FAILURES, $failures);
            $this->audit->record('two_factor_failed', $user, context: ['attempt' => $failures], actor: $user);

            if ($failures >= self::TWO_FACTOR_MAX_FAILURES) {
                // Verrouillage : la connexion en attente est annulée, il faut recommencer depuis le mot de passe.
                $this->forgetPending($request);
                $this->audit->record('two_factor_lockout', $user, context: ['failures' => $failures], actor: $user);
            }

            throw ValidationException::withMessages([$field => __('auth.two_factor_invalid')]);
        }

        $remember = (bool) $session->get(TwoFactorAuthentication::SESSION_PENDING_REMEMBER, false);
        $this->forgetPending($request);

        return $this->completeLogin($request, $user, $remember, [
            'two_factor' => true,
            'method' => $code !== null ? 'totp' : 'recovery_code',
        ]);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function completeLogin(Request $request, User $user, bool $remember, array $context): User
    {
        // « Se souvenir de moi » ignoré pour admin/editor (session courte imposée, security.md §12).
        Auth::guard('web')->login($user, $remember && ! $user->isStaff());

        $request->session()->regenerate();
        $request->session()->put(StaffSessionInactivity::SESSION_KEY, now()->getTimestamp());

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        $this->audit->record('login_succeeded', $user, context: $context, actor: $user);

        return $user;
    }

    private function forgetPending(Request $request): void
    {
        $request->session()->forget([
            TwoFactorAuthentication::SESSION_PENDING_ID,
            TwoFactorAuthentication::SESSION_PENDING_REMEMBER,
            TwoFactorAuthentication::SESSION_PENDING_AT,
            TwoFactorAuthentication::SESSION_FAILURES,
        ]);
    }

    /** Hash factice (mêmes paramètres Argon2id que les vrais) pour égaliser le temps de réponse. */
    private function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= Cache::rememberForever('auth:dummy-password-hash:'.md5((string) json_encode(config('hashing'))), fn () => Hash::make(Str::random(40)));
    }
}
