<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Garde de session (security.md §12), appliquée au groupe `api` :
 * - admin/editor : déconnexion après config('session.admin_lifetime') minutes d'inactivité (30) ;
 *   les autres rôles suivent SESSION_LIFETIME (expiration native de la session) ;
 * - compte désactivé (is_active = false) : déconnexion immédiate.
 * La requête continue ensuite en anonyme : les routes protégées répondent 401 (auth:sanctum).
 */
class StaffSessionInactivity
{
    public const SESSION_KEY = 'auth.last_activity_at';

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->hasSession()) {
            return $next($request);
        }

        $guard = Auth::guard('web');
        $user = $guard->user();
        $session = $request->session();
        $now = now()->getTimestamp();

        if ($user instanceof User) {
            $last = $session->get(self::SESSION_KEY);
            $limit = (int) config('session.admin_lifetime', 30) * 60;

            $expired = $user->isStaff() && is_int($last) && $now - $last > $limit;

            if ($expired || ! $user->is_active) {
                $guard->logout();
                $session->invalidate();
                $session->regenerateToken();
                // Le garde Sanctum a pu déjà résoudre l'utilisateur (AuthenticateSession) : on vide le cache
                // des gardes pour que auth:sanctum relise la session (désormais vide). Le remember_token a été
                // renouvelé par logout() : aucune reconnexion par cookie « se souvenir de moi ».
                Auth::forgetGuards();
            } else {
                $session->put(self::SESSION_KEY, $now);
            }
        }

        return $next($request);
    }
}
