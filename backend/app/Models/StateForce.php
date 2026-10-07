<?php

namespace App\Models;

use Database\Factories\StateForceFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * @property int $id
 * @property string $slug
 * @property string $status
 * @property bool $is_visible
 * @property string|null $latitude
 * @property string|null $longitude
 */
class StateForce extends Model
{
    /** @use HasFactory<StateForceFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'force_type_id', 'name', 'description', 'phone', 'phone_alt', 'emergency_phone', 'email', 'address',
        'city_id', 'district_id', 'geo_description', 'plus_code', 'latitude', 'longitude',
        'opening_hours', 'is_open_24h',
    ];

    protected $hidden = ['location', 'search_vector'];

    protected function casts(): array
    {
        return [
            'opening_hours' => 'array',
            'is_open_24h' => 'boolean',
            'is_visible' => 'boolean',
            'views_count' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<StateForce>  $query
     * @return Builder<StateForce>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('state_forces.is_visible', true)->where('state_forces.status', 'approved');
    }

    /**
     * @param  Builder<StateForce>  $query
     * @return Builder<StateForce>
     */
    public function scopeNear(Builder $query, float $lat, float $lng, int $radiusMeters, int $limit = 5000, ?int $forceTypeId = null, ?int $procedureTypeId = null): Builder
    {
        $nearby = DB::query()
            ->fromRaw(
                'fn_state_forces_nearby(?::double precision, ?::double precision, ?::integer, ?::integer, ?::bigint, ?::bigint)',
                [$lat, $lng, $radiusMeters, $limit, $forceTypeId, $procedureTypeId],
            )
            ->select('id', 'distance_m');

        return $query
            ->joinSub($nearby, 'nearby', 'nearby.id', '=', 'state_forces.id')
            ->addSelect('state_forces.*', 'nearby.distance_m');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<StateForceType, $this> */
    public function forceType(): BelongsTo
    {
        return $this->belongsTo(StateForceType::class, 'force_type_id');
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @return BelongsTo<District, $this> */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    /** @return BelongsToMany<ProcedureType, $this> */
    public function procedureTypes(): BelongsToMany
    {
        return $this->belongsToMany(ProcedureType::class, 'state_force_procedure_type')->withPivot('notes');
    }
}
