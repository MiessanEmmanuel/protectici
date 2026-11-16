<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MapMarkersRequest;
use App\Services\Directory\ProviderSearch;
use App\Services\Directory\StateForceSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class MapMarkerController extends Controller
{
    public const LIMIT = 500;

    public function __invoke(MapMarkersRequest $request, ProviderSearch $providers, StateForceSearch $forces): JsonResponse
    {
        $rows = $request->validated('type') === 'providers'
            ? $this->providerMarkers($request, $providers)
            : $this->forceMarkers($request, $forces);

        return response()->json(['data' => $rows]);
    }

    /**
     * Un point par siège et par agence ; branch_label = nom de l'agence (null = siège).
     *
     * @return Collection<int, array{slug: mixed, name: mixed, branch_label: mixed, lat: float, lng: float}>
     */
    private function providerMarkers(MapMarkersRequest $request, ProviderSearch $providers): Collection
    {
        $headOffices = $this->withinBbox($providers->markers($request->filters()), 'providers', $request)
            ->selectRaw('providers.id AS provider_id, providers.slug, providers.name, providers.latitude, providers.longitude, NULL::bigint AS branch_id, NULL::varchar AS branch_label');

        $branches = $this->withinBbox($providers->branchMarkers($request->filters()), 'provider_branches', $request)
            ->selectRaw('providers.id AS provider_id, providers.slug, providers.name, provider_branches.latitude, provider_branches.longitude, provider_branches.id AS branch_id, provider_branches.label AS branch_label');

        return $headOffices->toBase()
            ->unionAll($branches->toBase())
            ->orderBy('provider_id')
            ->orderByRaw('branch_id NULLS FIRST')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn ($m) => [
                'slug' => $m->slug,
                'name' => $m->name,
                'branch_label' => $m->branch_label,
                'lat' => (float) $m->latitude,
                'lng' => (float) $m->longitude,
            ])->values();
    }

    /** @return Collection<int, array{slug: string, name: string, lat: float, lng: float}> */
    private function forceMarkers(MapMarkersRequest $request, StateForceSearch $forces): Collection
    {
        return $this->withinBbox($forces->markers($request->filters()), 'state_forces', $request)
            ->select('state_forces.slug', 'state_forces.name', 'state_forces.latitude', 'state_forces.longitude')
            ->orderBy('state_forces.id')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn ($m) => [
                'slug' => $m->slug,
                'name' => $m->name,
                'lat' => (float) $m->latitude,
                'lng' => (float) $m->longitude,
            ])->values();
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function withinBbox(Builder $query, string $table, MapMarkersRequest $request): Builder
    {
        if ($bbox = $request->bbox()) {
            [$minLng, $minLat, $maxLng, $maxLat] = $bbox;
            $query->whereRaw("{$table}.location && ST_MakeEnvelope(?, ?, ?, ?, 4326)::geography", [$minLng, $minLat, $maxLng, $maxLat]);
        }

        return $query;
    }
}
