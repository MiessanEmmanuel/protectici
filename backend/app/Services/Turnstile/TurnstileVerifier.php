<?php

namespace App\Services\Turnstile;

interface TurnstileVerifier
{
    /** Vrai si la vérification est exigée (TURNSTILE_ENABLED). */
    public function enabled(): bool;

    public function verify(string $token, ?string $ip = null): bool;
}
