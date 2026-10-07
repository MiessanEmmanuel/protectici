<?php

namespace App\Support;

/**
 * HMAC-SHA256 d'une adresse IP (modele.md §6.4) : l'IP brute n'est jamais stockée par les formulaires publics.
 */
final class IpHasher
{
    public static function hash(?string $ip): ?string
    {
        if ($ip === null || $ip === '') {
            return null;
        }

        return hash_hmac('sha256', $ip, (string) config('app.ip_hash_secret'));
    }
}
