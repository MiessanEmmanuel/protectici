<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Demande de modification de champs sensibles (RG2). Cible : un prestataire OU une force étatique.
 * Le statut et les colonnes reviewed_* ne sont écrits que par le workflow d'administration (forceFill).
 *
 * @property int $id
 * @property int|null $provider_id
 * @property int|null $state_force_id
 * @property int|null $requested_by
 * @property array<string, array{old: mixed, new: mixed}> $changes
 * @property string $status
 * @property string|null $rejection_reason
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $created_at
 */
class ProviderChangeRequest extends Model
{
    protected $fillable = ['provider_id', 'state_force_id', 'requested_by', 'changes'];

    protected function casts(): array
    {
        return ['changes' => 'array', 'reviewed_at' => 'datetime'];
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

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** Fiche ciblée (relations provider et stateForce à charger au préalable). */
    public function establishment(): Provider|StateForce|null
    {
        return $this->provider_id !== null ? $this->provider : $this->stateForce;
    }
}
