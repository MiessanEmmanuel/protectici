<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Justificatif privé : jamais exposé par l'API publique. */
class ProviderDocument extends Model
{
    use SoftDeletes;

    protected $fillable = ['provider_id', 'type', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes', 'expires_at'];

    protected $hidden = ['path', 'disk'];

    protected function casts(): array
    {
        return ['expires_at' => 'date', 'verified_at' => 'datetime'];
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }
}
