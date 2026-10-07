<?php

namespace App\Services\Directory;

use App\Models\City;
use App\Models\StateForce;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class StateForceSearch
{
    public const DEFAULT_RADIUS_KM = 50;

    /**
     * @param  array<string, mixed>  $f  q, city, district, type[], procedure[], lat, lng, radius_km, sort
     * @return Builder<StateForce>
     */
    public function listing(array $f): Builder
    {
        $query = StateForce::query()->published()->with(['forceType', 'city', 'district']);
        $this->filter($query, $f, true);

        $sort = $f['sort'] ?? (! empty($f['q']) ? 'relevance' : (isset($f['lat'], $f['lng']) ? 'distance' : 'name'));
        match ($sort) {
            'relevance' => DirectoryFilters::orderByRelevance($query, 'state_forces', $f['q']),
            'distance' => $query->orderBy('nearby.distance_m'),
            default => null,
        };
        $query->orderBy('state_forces.name')->orderBy('state_forces.id');

        return $query;
    }

    /**
     * @param  array<string, mixed>  $f
     * @return Builder<StateForce>
     */
    public function markers(array $f): Builder
    {
        $query = StateForce::query()->published()->whereNotNull('state_forces.latitude');
        $this->filter($query, $f, false);

        return $query;
    }

    /**
     * @param  Builder<StateForce>  $query
     * @param  array<string, mixed>  $f
     */
    private function filter(Builder $query, array $f, bool $withDistance): void
    {
        if (! empty($f['q'])) {
            DirectoryFilters::fullText($query, 'state_forces', $f['q']);
        }
        if (! empty($f['city'])) {
            $query->whereIn('state_forces.city_id', City::query()->where('slug', $f['city'])->select('id'));
        }
        if (! empty($f['district'])) {
            $query->whereIn('state_forces.district_id', DirectoryFilters::districtIds($f['district']));
        }
        if (! empty($f['type'])) {
            $query->whereHas('forceType', fn ($q) => $q->whereIn('state_force_types.slug', $f['type']));
        }
        if (! empty($f['procedure'])) {
            $query->whereHas('procedureTypes', fn ($q) => $q->whereIn('procedure_types.slug', $f['procedure']));
        }

        if (isset($f['lat'], $f['lng'])) {
            $radiusM = (int) round(((float) ($f['radius_km'] ?? self::DEFAULT_RADIUS_KM)) * 1000);
            if ($withDistance) {
                $query->near((float) $f['lat'], (float) $f['lng'], $radiusM);
            } else {
                $query->whereIn('state_forces.id', DB::query()
                    ->fromRaw('fn_state_forces_nearby(?::double precision, ?::double precision, ?::integer, ?::integer, null::bigint, null::bigint)', [(float) $f['lat'], (float) $f['lng'], $radiusM, 5000])
                    ->select('id'));
            }
        }
    }
}
