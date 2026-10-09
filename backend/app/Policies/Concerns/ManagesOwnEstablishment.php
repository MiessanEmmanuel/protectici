<?php

namespace App\Policies\Concerns;

use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Autorisations « propriétaire » communes aux prestataires et aux forces étatiques (security.md §13).
 * La résolution des routes ne renvoie déjà que les fiches de l'utilisateur (404 sinon) ; ces règles complètent
 * avec l'état de la fiche et sont revérifiées par Policy à chaque action.
 */
trait ManagesOwnEstablishment
{
    protected function ownsEstablishment(User $user, Provider|StateForce $establishment): bool
    {
        return $establishment->user_id !== null && $establishment->user_id === $user->id && $establishment->deleted_at === null;
    }

    /** Lecture de sa propre fiche (tout statut). */
    public function viewOwn(User $user, Provider|StateForce $establishment): Response
    {
        return $this->ownsEstablishment($user, $establishment) ? Response::allow() : Response::denyAsNotFound();
    }

    /** Modification (champs non sensibles, dirigeants, médias, justificatifs, demandes) : interdite si suspendue. */
    public function updateOwn(User $user, Provider|StateForce $establishment): Response
    {
        if (! $this->ownsEstablishment($user, $establishment)) {
            return Response::denyAsNotFound();
        }

        return $establishment->status === 'suspended'
            ? Response::deny('Cette fiche est suspendue : elle n\'est plus modifiable. Contactez l\'équipe ProtectIci.')
            : Response::allow();
    }

    /** Re-soumission : uniquement une fiche rejetée. */
    public function resubmit(User $user, Provider|StateForce $establishment): Response
    {
        if (! $this->ownsEstablishment($user, $establishment)) {
            return Response::denyAsNotFound();
        }

        return $establishment->status === 'rejected'
            ? Response::allow()
            : Response::deny('Seule une fiche rejetée peut être soumise à nouveau.');
    }

    /** Modération (approbation, rejet, suspension, vérification, restauration) : administrateurs actifs. */
    public function moderate(User $user, Provider|StateForce $establishment): bool
    {
        return $user->isAdmin() && $user->is_active;
    }
}
