<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Verrouillage progressif de la connexion (security.md §18), en plus du limiteur `login` (5/min) :
 * toutes les 5 erreurs consécutives sur (IP + email), verrouillage de 1, puis 5, puis 15 minutes.
 * Compteur conservé 24 h, remis à zéro après une connexion réussie. Alerte (audit) à 10 échecs.
 * Le limiteur `login-staff` (3/min, admin/editor) est aussi appliqué ici, sans en-tête révélateur.
 */
class LoginThrottle
{
    /** @var array<int, int> Durées de verrouillage successives (minutes). */
    public const LOCK_MINUTES = [1, 5, 15];

    public const FAILURES_PER_STEP = 5;

    public const ALERT_THRESHOLD = 10;

    private const FAILURE_WINDOW = 86400;

    public function __construct(private readonly AuditLogger $audit) {}

    public function key(string $email, ?string $ip): string
    {
        return sha1(Str::lower($email).'|'.$ip);
    }

    /** @throws ThrottleRequestsException */
    public function ensureNotLocked(string $key): void
    {
        $until = Cache::get('login-lock:'.$key);
        if (is_int($until) && $until > now()->getTimestamp()) {
            throw $this->tooMany($until - now()->getTimestamp());
        }
    }

    /** Limiteur nommé `login-staff` (no-op pour les comptes non staff). */
    public function hitStaffLimiter(Request $request): void
    {
        $limiter = RateLimiter::limiter('login-staff');
        $limit = $limiter === null ? null : $limiter($request);
        if (! $limit instanceof Limit || $limit->maxAttempts >= PHP_INT_MAX) {
            return;
        }

        $key = 'login-staff:'.$limit->key;
        if (RateLimiter::tooManyAttempts($key, $limit->maxAttempts)) {
            throw $this->tooMany(RateLimiter::availableIn($key));
        }
        RateLimiter::hit($key, $limit->decaySeconds);
    }

    public function recordFailure(string $key, ?User $user): void
    {
        $failures = RateLimiter::hit('login-failures:'.$key, self::FAILURE_WINDOW);

        if ($failures % self::FAILURES_PER_STEP === 0) {
            $step = min(intdiv($failures, self::FAILURES_PER_STEP), count(self::LOCK_MINUTES)) - 1;
            $seconds = self::LOCK_MINUTES[$step] * 60;
            Cache::put('login-lock:'.$key, now()->getTimestamp() + $seconds, $seconds);
        }

        if ($failures === self::ALERT_THRESHOLD) {
            $this->audit->record('login_failures_alert', $user, context: ['failures' => $failures]);
        }
    }

    public function clear(string $key): void
    {
        RateLimiter::clear('login-failures:'.$key);
        Cache::forget('login-lock:'.$key);
    }

    private function tooMany(int $retryAfter): ThrottleRequestsException
    {
        return new ThrottleRequestsException('', null, ['Retry-After' => max(1, $retryAfter)]);
    }
}
