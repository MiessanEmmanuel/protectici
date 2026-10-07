<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ListProvidersRequest;
use App\Http\Requests\Api\PaginationRequest;
use App\Http\Requests\Api\PopularProvidersRequest;
use App\Http\Resources\ProviderDetailResource;
use App\Http\Resources\ProviderSummaryCollection;
use App\Http\Resources\ProviderSummaryResource;
use App\Http\Resources\ReviewCollection;
use App\Models\Provider;
use App\Services\Directory\ProviderSearch;
use App\Support\IpHasher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProviderController extends Controller
{
    public function __construct(private readonly ProviderSearch $search) {}

    public function index(ListProvidersRequest $request): ProviderSummaryCollection
    {
        $page = $this->search->listing($request->filters())
            ->paginate($request->perPage())
            ->withQueryString();

        return new ProviderSummaryCollection($page);
    }

    public function popular(PopularProvidersRequest $request): JsonResponse
    {
        $providers = $this->search->popular()->limit($request->limit())->get();

        return response()->json(['data' => ProviderSummaryResource::collection($providers)->resolve($request)]);
    }

    public function show(Request $request, Provider $provider): ProviderDetailResource
    {
        $provider->load(['city', 'district', 'serviceTypes', 'companyTypes', 'executives', 'gallery', 'logo']);

        return new ProviderDetailResource($provider);
    }

    /** Compteur de vues : dédoublonné par IP hachée (30 min) ; mise à jour sans toucher updated_at. */
    public function recordView(Request $request, Provider $provider): Response
    {
        $key = 'provider-view:'.$provider->id.':'.IpHasher::hash($request->ip());

        if (Cache::add($key, 1, now()->addMinutes(30))) {
            DB::table('providers')->where('id', $provider->id)->increment('views_count');
        }

        return response()->noContent();
    }

    public function reviews(PaginationRequest $request, Provider $provider): ReviewCollection
    {
        $page = $provider->reviews()
            ->published()
            ->with('user:id,first_name,last_name')
            ->orderByDesc('reviews.created_at')
            ->orderByDesc('reviews.id')
            ->paginate($request->perPage())
            ->withQueryString();

        return new ReviewCollection($page);
    }
}
