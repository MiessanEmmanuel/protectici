<?php

namespace App\Http\Middleware;

use App\Support\PublicCache;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Cache serveur + ETag des réponses JSON publiques (GET 200 uniquement). Usage : public.cache:{espace},{ttl}.
 *
 * Règles de sécurité (security.md, cache) :
 *  - jamais de lecture ni d'écriture du cache pour une requête authentifiée (session, jeton, en-tête Authorization) :
 *    elle passe telle quelle et SecurityHeaders y pose « no-store, private » ;
 *  - seules les réponses 200 sont stockées ; aucun en-tête (donc aucun cookie) n'est conservé, uniquement le corps ;
 *  - Vary: Cookie, Authorization pour que les caches navigateur ne mélangent pas anonyme et connecté.
 */
class CachePublicResponse
{
    private const MAX_QUERY_LENGTH = 400;

    public function handle(Request $request, Closure $next, string $namespace, string $ttl = '60'): SymfonyResponse
    {
        if (! $request->isMethod('GET') || ! PublicCache::enabled() || $this->isPersonal($request)) {
            return $next($request);
        }

        // Anti-amplification : une requête à la chaîne de paramètres démesurée ne crée pas d'entrée de cache.
        if (strlen((string) $request->getQueryString()) > self::MAX_QUERY_LENGTH) {
            return $next($request);
        }

        $seconds = max(1, (int) $ttl);
        $key = PublicCache::key($namespace, $request);
        $entry = Cache::get($key);

        if (! is_array($entry) || ! isset($entry['body'], $entry['etag'], $entry['type']) || ! is_string($entry['body'])) {
            /** @var SymfonyResponse $response */
            $response = $next($request);
            $body = $response->getContent();

            if ($response->getStatusCode() !== 200 || ! is_string($body) || strlen($body) > (int) config('cache.public.max_body_bytes')
                || ! str_contains((string) $response->headers->get('Content-Type'), 'json')) {
                return $response;
            }

            $entry = ['body' => $body, 'etag' => 'W/"'.sha1($body).'"', 'type' => (string) $response->headers->get('Content-Type')];
            Cache::put($key, $entry, $seconds);

            return $this->decorate($request, $response, $entry['etag'], $seconds);
        }

        return $this->decorate($request, new Response($entry['body'], 200, ['Content-Type' => $entry['type']]), (string) $entry['etag'], $seconds);
    }

    private function isPersonal(Request $request): bool
    {
        return $request->headers->has('Authorization')
            || $request->user('sanctum') !== null
            || $request->user() !== null;
    }

    private function decorate(Request $request, SymfonyResponse $response, string $etag, int $ttl): SymfonyResponse
    {
        $matches = array_map('trim', explode(',', (string) $request->headers->get('If-None-Match')));
        if (in_array($etag, $matches, true) || in_array('*', $matches, true)) {
            $response->setContent('');
            $response->setStatusCode(304);
            $response->headers->remove('Content-Type');
        }

        $response->headers->set('ETag', $etag);
        $response->headers->set('Cache-Control', 'public, max-age='.$ttl);
        $response->headers->set('Vary', 'Cookie, Authorization');

        return $response;
    }
}
