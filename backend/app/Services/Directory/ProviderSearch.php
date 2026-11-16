<?php

namespace App\Services\Directory;

use App\Models\City;
use App\Models\Provider;
use App\Models\ProviderBranch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Construit les requêtes publiques sur les prestataires. Les filtres arrivent déjà validés (FormRequest).
 *
 * @phpstan-type Filters array<string, mixed>
 */
class ProviderSearch
{
    public const DEFAULT_RADIUS_KM = 50;

    /**
     * @param  array<string, mixed>  $f  valeurs validées : q, city, district, service[], company_type[], lat, lng, radius_km, sort
     * @return Builder<Provider>
     */
    public function listing(array $f): Builder
    {
        $query = Provider::query()->published()->with(['city', 'district', 'serviceTypes', 'logo'])->withCount('branches');
        $this->filter($query, $f, true);
        $this->sort($query, $f);

        return $query;
    }

    /**
     * Requête filtrée pour la carte : points des sièges (sans distance ni relations).
     *
     * @param  array<string, mixed>  $f
     * @return Builder<Provider>
     */
    public function markers(array $f): Builder
    {
        $query = Provider::query()->published()->whereNotNull('providers.latitude');
        $this->filter($query, $f, false);

        return $query;
    }

    /**
     * Requête filtrée pour la carte : un point par agence géolocalisée. Le siège n'a pas besoin d'être géolocalisé.
     *
     * @param  array<string, mixed>  $f
     * @return Builder<Provider>
     */
    public function branchMarkers(array $f): Builder
    {
        $query = Provider::query()->published()
            ->join('provider_branches', 'provider_branches.provider_id', '=', 'providers.id')
            ->whereNotNull('provider_branches.latitude');
        $this->filter($query, $f, false);

        return $query;
    }

    /**
     * @param  Builder<Provider>  $query
     * @param  array<string, mixed>  $f
     */
    private function filter(Builder $query, array $f, bool $withDistance): void
    {
        if (! empty($f['q'])) {
            DirectoryFilters::fullText($query, 'providers', $f['q']);
        }
        // Ville / quartier : correspondance sur le siège OU sur une agence.
        if (! empty($f['city'])) {
            $cityIds = City::query()->where('slug', $f['city'])->select('id');
            $query->where(fn ($w) => $w->whereIn('providers.city_id', $cityIds)
                ->orWhereIn('providers.id', ProviderBranch::query()->whereIn('city_id', $cityIds)->select('provider_id')));
        }
        if (! empty($f['district'])) {
            $districtIds = DirectoryFilters::districtIds($f['district']);
            $query->where(fn ($w) => $w->whereIn('providers.district_id', $districtIds)
                ->orWhereIn('providers.id', ProviderBranch::query()->whereIn('district_id', $districtIds)->select('provider_id')));
        }
        if (! empty($f['service'])) {
            $query->whereHas('serviceTypes', fn ($q) => $q->whereIn('service_types.slug', $f['service']));
        }
        if (! empty($f['company_type'])) {
            $query->whereHas('companyTypes', fn ($q) => $q->whereIn('company_types.slug', $f['company_type']));
        }

        if (isset($f['lat'], $f['lng'])) {
            $radiusM = (int) round(((float) ($f['radius_km'] ?? self::DEFAULT_RADIUS_KM)) * 1000);
            if ($withDistance) {
                $query->near((float) $f['lat'], (float) $f['lng'], $radiusM);
            } else {
                $query->whereIn('providers.id', DB::query()
                    ->fromRaw('fn_providers_nearby(?::double precision, ?::double precision, ?::integer, ?::integer)', [(float) $f['lat'], (float) $f['lng'], $radiusM, 5000])
                    ->select('id'));
            }
        }
    }

    /**
     * @param  Builder<Provider>  $query
     * @param  array<string, mixed>  $f
     */
    private function sort(Builder $query, array $f): void
    {
        $sort = $f['sort'] ?? null;
        $hasPoint = isset($f['lat'], $f['lng']);

        if ($sort === null) {
            $sort = ! empty($f['q']) ? 'relevance' : ($hasPoint ? 'distance' : 'name');
        }

        match ($sort) {
            'relevance' => DirectoryFilters::orderByRelevance($query, 'providers', $f['q']),
            'distance' => $query->orderBy('nearby.distance_m'),
            '-rating' => $query->orderByDesc('providers.rating_avg')->orderByDesc('providers.rating_count'),
            '-popular' => $query->orderByDesc('providers.is_featured')->orderByDesc('providers.views_count')->orderByDesc('providers.rating_avg'),
            default => null,
        };

        $query->orderBy('providers.name')->orderBy('providers.id');
    }

    /**
     * Fiches « populaires » : mises en avant puis mieux notées.
     *
     * @return Builder<Provider>
     */
    public function popular(): Builder
    {
        return Provider::query()->published()->with(['city', 'district', 'serviceTypes', 'logo'])->withCount('branches')
            ->orderByDesc('providers.is_featured')
            ->orderByDesc('providers.rating_avg')
            ->orderByDesc('providers.rating_count')
            ->orderByDesc('providers.views_count')
            ->orderBy('providers.id');
    }
}
