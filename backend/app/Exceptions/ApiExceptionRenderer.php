<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Format d'erreur JSON uniforme (CLAUDE.md §4.4, security.md §20) : jamais de trace, de chemin ni de SQL.
 * { "message": "...", "errors": { champ: [..] } (422 uniquement) }
 */
class ApiExceptionRenderer
{
    private const MESSAGES = [
        400 => 'Requête invalide.',
        401 => 'Authentification requise.',
        403 => 'Action non autorisée.',
        404 => 'Ressource introuvable.',
        405 => 'Méthode non autorisée.',
        409 => 'Conflit avec l\'état actuel de la ressource.',
        413 => 'Requête trop volumineuse.',
        415 => 'Type de contenu non pris en charge.',
        419 => 'Session expirée. Veuillez recharger la page.',
        422 => 'Les données fournies sont invalides.',
        429 => 'Trop de requêtes. Veuillez réessayer plus tard.',
        500 => 'Une erreur est survenue.',
        503 => 'Service temporairement indisponible.',
    ];

    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        if ($e instanceof ValidationException) {
            return response()->json([
                'message' => self::MESSAGES[422],
                'errors' => $e->errors(),
            ], 422);
        }

        if ($e instanceof AuthenticationException) {
            return response()->json(['message' => self::MESSAGES[401]], 401);
        }

        if ($e instanceof AuthorizationException) {
            return response()->json(['message' => self::MESSAGES[403]], 403);
        }

        if ($e instanceof ModelNotFoundException) {
            return response()->json(['message' => self::MESSAGES[404]], 404);
        }

        if ($e instanceof TokenMismatchException) {
            return response()->json(['message' => self::MESSAGES[419]], 419);
        }

        if ($e instanceof ApiHttpException) {
            return response()->json(
                ['message' => $e->getMessage()] + ($e->errorCode !== null ? ['code' => $e->errorCode] : []),
                $e->getStatusCode(),
                $e->getHeaders(),
            );
        }

        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            $headers = array_intersect_key($e->getHeaders(), array_flip(['Retry-After', 'Allow', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']));

            return response()->json(
                ['message' => self::MESSAGES[$status] ?? ($status >= 500 ? self::MESSAGES[500] : self::MESSAGES[400])],
                $status,
                $headers,
            );
        }

        // Erreur interne : détail dans les logs uniquement, identifiant de corrélation côté client.
        $requestId = (string) Str::uuid();
        Log::error('Erreur interne non gérée', [
            'request_id' => $requestId,
            'exception' => $e,
        ]);

        return response()->json(
            ['message' => self::MESSAGES[500], 'request_id' => $requestId],
            500,
            ['X-Request-Id' => $requestId],
        );
    }
}
