<?php

namespace App\Services\Newsletter;

/**
 * Jetons signés (HMAC-SHA256 avec la clé de l'application) des liens de newsletter.
 *  - confirmation : `c.{id}.{expiration}.{aléa}.{signature}`, valable 24 h ; son empreinte est aussi stockée
 *    (usage unique, invalidé par toute nouvelle demande) ;
 *  - désinscription : `u.{id}.0.{aléa}.{signature}`, sans expiration (présent dans chaque e-mail).
 * Un jeton ne contient aucune adresse e-mail.
 */
final class NewsletterTokens
{
    public const CONFIRM = 'c';

    public const UNSUBSCRIBE = 'u';

    public const CONFIRM_TTL_HOURS = 24;

    public static function make(string $purpose, int $subscriberId): string
    {
        $expires = $purpose === self::CONFIRM ? now()->addHours(self::CONFIRM_TTL_HOURS)->getTimestamp() : 0;
        $nonce = bin2hex(random_bytes(8));

        return "{$purpose}.{$subscriberId}.{$expires}.{$nonce}.".self::sign($purpose, $subscriberId, $expires, $nonce);
    }

    /** @return int|null identifiant de l'abonné si le jeton est authentique, du bon type et non expiré */
    public static function verify(string $token, string $purpose): ?int
    {
        if (strlen($token) > 200 || preg_match('/^([cu])\.(\d{1,18})\.(\d{1,12})\.([0-9a-f]{16})\.([0-9a-f]{64})$/', $token, $m) !== 1) {
            return null;
        }
        [, $type, $id, $expires, $nonce, $signature] = $m;
        if ($type !== $purpose || ! hash_equals(self::sign($purpose, (int) $id, (int) $expires, $nonce), $signature)) {
            return null;
        }
        if ($purpose === self::CONFIRM && (int) $expires < now()->getTimestamp()) {
            return null;
        }

        return (int) $id;
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    private static function sign(string $purpose, int $id, int $expires, string $nonce): string
    {
        return hash_hmac('sha256', "newsletter|{$purpose}|{$id}|{$expires}|{$nonce}", (string) config('app.key'));
    }
}
