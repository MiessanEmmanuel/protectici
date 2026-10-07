<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderChangeRequest extends Model
{
    protected $fillable = ['provider_id', 'changes'];

    protected function casts(): array
    {
        return ['changes' => 'array', 'reviewed_at' => 'datetime'];
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }
}
