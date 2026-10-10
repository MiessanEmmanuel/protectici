<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Destinataire d'une demande de devis (une fiche prestataire). Le statut et la réponse ne sont jamais assignables
 * en masse : ils sont écrits par QuoteService.
 *
 * @property int $id
 * @property int $quote_request_id
 * @property int $provider_id
 * @property string $status
 * @property Carbon|null $sent_at
 * @property Carbon|null $viewed_at
 * @property Carbon|null $replied_at
 * @property string|null $response_message
 * @property int|null $quoted_amount
 */
class QuoteRequestRecipient extends Model
{
    protected $fillable = ['quote_request_id', 'provider_id'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'viewed_at' => 'datetime', 'replied_at' => 'datetime', 'quoted_amount' => 'integer'];
    }

    /**
     * Destinataires dont la fiche (non supprimée) appartient à $user, pour une demande non supprimée.
     *
     * @param  Builder<QuoteRequestRecipient>  $query
     * @return Builder<QuoteRequestRecipient>
     */
    public function scopeInbox(Builder $query, User $user): Builder
    {
        return $query
            ->whereHas('provider', fn (Builder $q) => $q->where('user_id', $user->id))
            ->whereHas('quoteRequest');
    }

    /** @return BelongsTo<QuoteRequest, $this> */
    public function quoteRequest(): BelongsTo
    {
        return $this->belongsTo(QuoteRequest::class);
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }
}
