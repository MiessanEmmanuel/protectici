<?php

namespace App\Services\Turnstile;

/** Turnstile désactivé (local, test) : aucune vérification, aucun appel réseau. */
final class NullTurnstileVerifier implements TurnstileVerifier
{
    public function enabled(): bool
    {
        return false;
    }

    public function verify(string $token, ?string $ip = null): bool
    {
        return true;
    }
}
