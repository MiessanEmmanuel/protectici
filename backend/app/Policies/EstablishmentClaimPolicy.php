<?php

namespace App\Policies;

use App\Models\EstablishmentClaim;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Revendications de fiche (contrat §10.3). Dépôt : compte actif à l'e-mail vérifié (vérifié aussi par le middleware
 * `verified.api`), sur une fiche PUBLIÉE uniquement (sinon 404 : on ne révèle pas une fiche non publiée). Les cas
 * « déjà gérée » et « demande en cours » (409) sont contrôlés par ClaimService sous verrou.
 * Traitement : administrateurs actifs (le middleware impose en plus la 2FA).
 */
class EstablishmentClaimPolicy
{
    public function create(User $user, Provider|StateForce $establishment): Response
    {
        $published = $establishment->is_visible && $establishment->status === 'approved' && $establishment->deleted_at === null;
        if (! $published) {
            return Response::denyAsNotFound();
        }
        if (! $user->is_active || ! $user->hasVerifiedEmail()) {
            return Response::deny('Veuillez vérifier votre adresse e-mail pour revendiquer une fiche.');
        }

        return Response::allow();
    }

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() && $user->is_active;
    }

    public function view(User $user, EstablishmentClaim $claim): bool
    {
        return $user->isAdmin() && $user->is_active;
    }

    /** Acceptation, refus, téléchargement du justificatif, attribution directe. */
    public function review(User $user, ?EstablishmentClaim $claim = null): bool
    {
        return $user->isAdmin() && $user->is_active;
    }
}
