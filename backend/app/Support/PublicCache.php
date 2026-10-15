<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Cache des réponses publiques anonymes, par « espace » (directory, blog, site).
 * Les clés embarquent un jeton de version propre à l'espace : toute écriture le renouvelle
 * (bump), ce qui invalide d'un coup toutes les entrées de l'espace sans énumérer les clés.
 * Le TTL court reste le filet de sécurité pour les écritures SQL directes (compteurs de vues, triggers).
 */
final class PublicCache
{
    public const DIRECTORY = 'directory';

    public const BLOG = 'blog';

    public const SITE = 'site';

    /** @var list<string> */
    public const NAMESPACES = [self::DIRECTORY, self::BLOG, self::SITE];

    public static function enabled(): bool
    {
        return (bool) config('cache.public.enabled', true);
    }

    public static function token(string $namespace): string
    {
        $value = Cache::get(self::tokenKey($namespace));
        if (is_string($value) && $value !== '') {
            return $value;
        }

        $value = bin2hex(random_bytes(8));
        Cache::forever(self::tokenKey($namespace), $value);

        return $value;
    }

    /** Invalide toutes les entrées des espaces donnés (jeton aléatoire : pas de course sur un compteur). */
    public static function bump(string ...$namespaces): void
    {
        foreach ($namespaces as $namespace) {
            Cache::forever(self::tokenKey($namespace), bin2hex(random_bytes(8)));
        }
    }

    /** Clé = espace + jeton + empreinte de l'URL absolue normalisée (hôte inclus : les liens de pagination en dépendent). */
    public static function key(string $namespace, Request $request): string
    {
        $query = $request->query();
        self::sortRecursive($query);

        return sprintf(
            'pubcache:%s:%s:%s',
            $namespace,
            self::token($namespace),
            sha1($request->getSchemeAndHttpHost().$request->getPathInfo().'?'.http_build_query($query)),
        );
    }

    private static function tokenKey(string $namespace): string
    {
        return 'pubcache-token:'.$namespace;
    }

    /** @param array<array-key, mixed> $data */
    private static function sortRecursive(array &$data): void
    {
        ksort($data);
        foreach ($data as &$value) {
            if (is_array($value)) {
                self::sortRecursive($value);
            }
        }
    }
}
