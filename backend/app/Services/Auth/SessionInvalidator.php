<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Invalidation des sessions d'un utilisateur (changement/réinitialisation de mot de passe, désactivation).
 * - Supprime les lignes de la table `sessions` (driver database) ;
 * - renouvelle le remember_token (les cookies « se souvenir de moi » existants deviennent invalides).
 * En complément, le middleware AuthenticateSession de Sanctum déconnecte toute session dont
 * l'empreinte du mot de passe ne correspond plus (quel que soit le driver).
 */
class SessionInvalidator
{
    public function destroyAll(User $user): void
    {
        $this->query($user)->delete();
        $this->cycleRememberToken($user);
    }

    public function destroyOthers(User $user, ?string $currentSessionId): void
    {
        $query = $this->query($user);
        if ($currentSessionId !== null) {
            $query->where('id', '!=', $currentSessionId);
        }
        $query->delete();
        $this->cycleRememberToken($user);
    }

    private function cycleRememberToken(User $user): void
    {
        $user->setRememberToken(Str::random(60));
        $user->saveQuietly();
    }

    private function query(User $user): Builder
    {
        return DB::connection(config('session.connection'))
            ->table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->getKey());
    }
}
