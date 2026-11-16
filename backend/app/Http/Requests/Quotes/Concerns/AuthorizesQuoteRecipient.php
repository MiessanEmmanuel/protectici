<?php

namespace App\Http\Requests\Quotes\Concerns;

use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use Illuminate\Support\Facades\Gate;

/**
 * Autorisation AVANT la validation du corps (R26) : boîte de devis (403) puis destinataire appartenant à
 * l'utilisateur (404 sinon). Un corps invalide ne donne donc jamais 422 sur le devis d'une autre fiche.
 */
trait AuthorizesQuoteRecipient
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        Gate::forUser($user)->authorize('inbox', QuoteRequest::class);
        $recipient = QuoteRequestRecipient::query()->inbox($user)->with('quoteRequest')->findOrFail((int) $this->route('id'));
        Gate::forUser($user)->authorize('receive', [$recipient->quoteRequest, $recipient]);

        return true;
    }
}
