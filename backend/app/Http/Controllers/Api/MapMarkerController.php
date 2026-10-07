<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\MapMarkersRequest;
use App\Services\Directory\ProviderSearch;
use App\Services\Directory\StateForceSearch;
use Illuminate\Http\JsonResponse;

class MapMarkerController extends Controller
{
    public const LIMIT = 500;

    public function __invoke(MapMarkersRequest $request, ProviderSearch $providers, StateForceSearch $forces): JsonResponse
    {
        $isProviders = $request->validated('type') === 'providers';
        $table = $isProviders ? 'providers' : 'state_forces';
        $query = $isProviders ? $providers->markers($request->filters()) : $forces->markers($request->filters());

        if ($bbox = $request->bbox()) {
            [$minLng, $minLat, $maxLng, $maxLat] = $bbox;
            $query->whereRaw("{$table}.location && ST_MakeEnvelope(?, ?, ?, ?, 4326)::geography", [$minLng, $minLat, $maxLng, $maxLat]);
        }

        $rows = $query
            ->select("{$table}.slug", "{$table}.name", "{$table}.latitude", "{$table}.longitude")
            ->orderBy("{$table}.id")
            ->limit(self::LIMIT)
            ->get()
            ->map(fn ($m) => [
                'slug' => $m->slug,
                'name' => $m->name,
                'lat' => (float) $m->latitude,
                'lng' => (float) $m->longitude,
            ])->values();

        return response()->json(['data' => $rows]);
    }
}
