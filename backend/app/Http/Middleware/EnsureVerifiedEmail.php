<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiHttpException;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** E-mail vérifié obligatoire (contrat §7) : 403 avec message français et code `email_unverified`. */
class EnsureVerifiedEmail
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->hasVerifiedEmail()) {
            throw new ApiHttpException(403, 'Veuillez confirmer votre adresse e-mail pour continuer.', [], 'email_unverified');
        }

        return $next($request);
    }
}
