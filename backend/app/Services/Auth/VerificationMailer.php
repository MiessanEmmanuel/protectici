<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;

/**
 * Envoi des liens de confirmation, limité à 3 par heure et par adresse destinataire (anti-bombardement).
 * Au dépassement, rien n'est envoyé et l'appelant répond comme d'habitude.
 */
class VerificationMailer
{
    /**
     * Renvoi public : lien envoyé seulement si le compte existe, est actif et non vérifié.
     * 10 demandes/heure/IP (au-delà : rien n'est envoyé, la réponse ne change pas), durée égalisée.
     */
    public function resendByEmail(string $email, string $ip): void
    {
        $microseconds = max(0, (int) config('auth.register_timebox_ms', 1000)) * 1000;

        (new Timebox)->call(function () use ($email, $ip) {
            $ipKey = 'verification-resend-ip|'.sha1($ip);
            if (RateLimiter::tooManyAttempts($ipKey, 10)) {
                return;
            }
            RateLimiter::hit($ipKey, 3600);

            /** @var User|null $user */
            $user = User::query()->where('email', Str::lower(trim($email)))->first();
            if ($user !== null && $user->is_active && ! $user->hasVerifiedEmail()) {
                $this->send($user);
            }
        }, $microseconds);
    }

    public function send(User $user): bool
    {
        $key = 'verification-mail|'.sha1(mb_strtolower((string) $user->email));
        $max = (int) config('auth.verification_mail_per_hour', 3);

        if (RateLimiter::tooManyAttempts($key, $max)) {
            return false;
        }

        RateLimiter::hit($key, 3600);
        $user->sendEmailVerificationNotification();

        return true;
    }
}
