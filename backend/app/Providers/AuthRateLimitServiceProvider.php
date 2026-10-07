<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Auth\TwoFactorAuthentication;
use App\Services\Turnstile\CloudflareTurnstileVerifier;
use App\Services\Turnstile\NullTurnstileVerifier;
use App\Services\Turnstile\TurnstileVerifier;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

/**
 * Authentification : limiteurs nommés (security.md §18) et liaison Turnstile (§15).
 * Les réponses 429 sont génériques (ApiExceptionRenderer) avec Retry-After.
 */
class AuthRateLimitServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(TurnstileVerifier::class, function () {
            if (! config('services.turnstile.enabled')) {
                return new NullTurnstileVerifier;
            }

            return new CloudflareTurnstileVerifier(
                (string) config('services.turnstile.secret'),
                (string) config('services.turnstile.verify_url'),
            );
        });
    }

    public function boot(): void
    {
        // Connexion : 5 / minute / (IP + email normalisé). Verrouillage progressif : LoginThrottle.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by('login|'.self::normalizedEmail($request).'|'.$request->ip()));

        // Comptes admin/editor : 3 / minute. Appliqué dans le service de connexion (pas en
        // middleware) pour ne pas révéler le rôle via l'en-tête X-RateLimit-Limit.
        RateLimiter::for('login-staff', function (Request $request) {
            $email = self::normalizedEmail($request);
            $isStaff = $email !== '' && User::query()
                ->where('email', $email)
                ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_EDITOR])
                ->exists();

            return $isStaff
                ? Limit::perMinute(3)->by('login-staff|'.$email.'|'.$request->ip())
                : Limit::none();
        });

        // 2FA : 5 essais / minute puis 20 / heure, par utilisateur (en attente ou connecté).
        RateLimiter::for('two-factor', function (Request $request) {
            $pending = $request->hasSession() ? $request->session()->get(TwoFactorAuthentication::SESSION_PENDING_ID) : null;
            $key = 'two-factor|'.($pending ?? $request->user()?->getAuthIdentifier() ?? $request->ip());

            return [
                Limit::perMinute(5)->by($key),
                Limit::perHour(20)->by($key.'|hour'),
            ];
        });

        // Mot de passe oublié / renvoi de vérification : 3 / heure / email, 10 / heure / IP.
        RateLimiter::for('password-reset', function (Request $request) {
            $user = $request->user();
            $email = $user instanceof User ? $user->email : self::normalizedEmail($request);

            return [
                Limit::perHour(3)->by('email|'.mb_strtolower((string) $email)),
                Limit::perHour(10)->by('ip|'.$request->ip()),
            ];
        });

        // Création de compte : 5 / heure / IP.
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(5)->by('register|'.$request->ip()));

        // Lien de vérification d'email : 10 / minute / IP.
        RateLimiter::for('verify-email', fn (Request $request) => Limit::perMinute(10)->by('verify|'.$request->ip()));

        // API authentifiée : 120 / minute / utilisateur.
        RateLimiter::for('api-authenticated', fn (Request $request) => Limit::perMinute(120)
            ->by('api|'.($request->user()?->getAuthIdentifier() ?? $request->ip())));
    }

    public static function normalizedEmail(Request $request): string
    {
        $email = $request->input('email');

        return is_string($email) ? Str::lower(trim($email)) : '';
    }
}
