<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiHttpException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Corps annoncé en JSON mais non décodable : 400 au format d'erreur uniforme (security.md §1 : rejeter plutôt
 * qu'interpréter). Sans ce contrôle, Laravel traite le corps comme vide et l'action réussit sans rien changer.
 */
class RejectMalformedJson
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isJson()) {
            $content = $request->getContent();
            if (is_string($content) && trim($content) !== '' && ! json_validate($content)) {
                throw new ApiHttpException(400, 'Le corps de la requête n\'est pas un JSON valide.', [], 'malformed_json');
            }
        }

        return $next($request);
    }
}
