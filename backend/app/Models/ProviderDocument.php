<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Justificatif privé (prestataire ou force étatique) : jamais exposé par l'API publique ni par une URL.
 *
 * @property int $id
 * @property int|null $provider_id
 * @property int|null $state_force_id
 * @property string $type
 * @property string $disk
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $size_bytes
 * @property Carbon|null $verified_at
 * @property Carbon|null $created_at
 */
class ProviderDocument extends Model
{
    use SoftDeletes;

    protected $fillable = ['provider_id', 'state_force_id', 'type', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes', 'expires_at'];

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

    /** @return BelongsTo<StateForce, $this> */
    public function stateForce(): BelongsTo
    {
        return $this->belongsTo(StateForce::class);
    }
}
