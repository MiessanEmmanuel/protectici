<?php

namespace App\Policies;

use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Devis (security.md §12-§13) :
 * - boîte de réception : propriétaire d'au moins une fiche prestataire non supprimée ;
 * - voir / répondre / refuser : uniquement le propriétaire de la fiche DESTINATAIRE (sinon 404, jamais 403) ;
 * - acheminement, statut, consultation des coordonnées du demandeur côté administration : admin.
 */
class QuoteRequestPolicy
{
    public function manage(User $user): bool
    {
        return $user->isAdmin();
    }

    public function inbox(User $user): Response
    {
        return Provider::query()->where('user_id', $user->id)->exists()
            ? Response::allow()
            : Response::deny('Vous ne possédez aucune fiche prestataire.');
    }

    /** Voir les coordonnées du demandeur et répondre : le propriétaire de la fiche destinataire. */
    public function receive(User $user, QuoteRequest $quote, QuoteRequestRecipient $recipient): Response
    {
        $ownerId = Provider::query()->whereKey($recipient->provider_id)->value('user_id');

        return $recipient->quote_request_id === $quote->id && $ownerId !== null && $ownerId === $user->id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
