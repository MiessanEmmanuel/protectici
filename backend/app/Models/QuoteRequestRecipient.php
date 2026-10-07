<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteRequestRecipient extends Model
{
    protected $fillable = ['quote_request_id', 'provider_id'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'viewed_at' => 'datetime', 'replied_at' => 'datetime'];
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
