<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProviderSummaryResource;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Services\Directory\ProviderSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class HomeController extends Controller
{
    public function __invoke(Request $request, ProviderSearch $search): JsonResponse
    {
        $stats = Cache::remember('home:stats:v1', 60, fn () => [
            'providers' => Provider::query()->published()->count(),
            'state_forces' => StateForce::query()->published()->count(),
            'service_types' => ServiceType::query()->visible()->count(),
        ]);

        $popular = ProviderSummaryResource::collection($search->popular()->limit(8)->get())->resolve($request);

        return response()->json(['data' => [
            'stats' => $stats,
            'popular_providers' => $popular,
        ]])->header('Cache-Control', 'public, max-age=60');
    }
}
