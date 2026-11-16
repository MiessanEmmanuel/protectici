<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Revendication d'une fiche sans propriétaire par un compte (plan_import_etablissements.md §5.2).
 * Cible : un prestataire OU une force étatique. Statut, justificatif et reviewed_* sont écrits par le serveur.
 *
 * @property int $id
 * @property int|null $provider_id
 * @property int|null $state_force_id
 * @property int|null $user_id
 * @property string $submitter_role manager|employee|other
 * @property string $phone
 * @property string|null $message
 * @property string $document_disk
 * @property string|null $document_path
 * @property string|null $document_original_name
 * @property string|null $document_mime_type
 * @property int|null $document_size_bytes
 * @property string $status pending|approved|rejected
 * @property string|null $rejection_reason
 * @property int|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class EstablishmentClaim extends Model
{
    public const STATUSES = ['pending', 'approved', 'rejected'];

    protected $fillable = ['submitter_role', 'phone', 'message'];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
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
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** Fiche ciblée (relations provider et stateForce à charger au préalable). */
    public function establishment(): Provider|StateForce|null
    {
        return $this->provider_id !== null ? $this->provider : $this->stateForce;
    }
}
