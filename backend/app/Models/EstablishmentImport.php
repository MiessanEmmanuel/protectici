<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Lot d'import Excel de fiches (plan_import_etablissements.md). Tout est écrit par le serveur (forceFill) :
 * aucune colonne n'est remplissable depuis une requête.
 *
 * @property int $id
 * @property string $type provider|state_force
 * @property string $status uploaded|analyzing|ready|importing|done|failed|cancelled
 * @property string $publish_mode publish|pending
 * @property string $file_disk
 * @property string|null $file_path
 * @property string $original_name
 * @property int $rows_total
 * @property int $rows_valid
 * @property int $rows_invalid
 * @property int $rows_duplicate
 * @property int $rows_created
 * @property array<string, mixed>|null $report
 * @property string|null $failure_message
 * @property int|null $created_by
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class EstablishmentImport extends Model
{
    public const TYPES = ['provider', 'state_force'];

    public const STATUSES = ['uploaded', 'analyzing', 'ready', 'importing', 'done', 'failed', 'cancelled'];

    public const PUBLISH_MODES = ['publish', 'pending'];

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'report' => 'array',
            'confirmed_at' => 'datetime',
            'finished_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<Provider, $this> */
    public function providers(): HasMany
    {
        return $this->hasMany(Provider::class, 'import_id');
    }

    /** @return HasMany<StateForce, $this> */
    public function stateForces(): HasMany
    {
        return $this->hasMany(StateForce::class, 'import_id');
    }
}
