<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * En-têtes de sécurité de l'API (security.md §19).
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), payment=(), geolocation=(self)',
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            'Cross-Origin-Resource-Policy' => 'same-site',
        ];

        if (app()->environment(['production', 'staging'])) {
            $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        }

        foreach ($headers as $name => $value) {
            $response->headers->set($name, $value);
        }

        // Réponses authentifiées ou personnelles : jamais mises en cache.
        if ($request->user() !== null) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }

        // X-Powered-By est ajouté par PHP lui-même (expose_php), hors de l'objet Response :
        // on le retire aussi au niveau du runtime. En production, positionner aussi expose_php=Off.
        $response->headers->remove('X-Powered-By');
        header_remove('X-Powered-By');

        return $response;
    }
}
