<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 2FA obligatoire pour admin/editor (security.md §12) : alias `2fa.staff`, à placer après auth:sanctum
 * sur les routes d'administration. Un compte staff sans 2FA confirmée reçoit 403.
 */
class EnsureTwoFactorForStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->isStaff() && ! $user->hasTwoFactorEnabled()) {
            return response()->json(['message' => __('auth.two_factor_setup_required')], 403);
        }

        return $next($request);
    }
}
