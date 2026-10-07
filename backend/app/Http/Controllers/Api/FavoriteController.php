<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiHttpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PaginationRequest;
use App\Http\Resources\ProviderSummaryCollection;
use App\Models\Provider;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class FavoriteController extends Controller
{
    public function index(PaginationRequest $request): ProviderSummaryCollection
    {
        $page = $request->user()->favoriteProviders()
            ->published()
            ->with(['city', 'district', 'serviceTypes', 'logo'])
            ->orderByDesc('favorites.created_at')
            ->paginate($request->perPage())
            ->withQueryString();

        return new ProviderSummaryCollection($page);
    }

    public function store(Request $request, Provider $provider): Response
    {
        $decision = Gate::inspect('favorite', $provider);
        if ($decision->denied()) {
            throw new ApiHttpException(403, $decision->message() ?: 'Action non autorisée.');
        }

        $request->user()->favoriteProviders()->syncWithoutDetaching([$provider->id]);

        return response()->noContent();
    }

    public function destroy(Request $request, Provider $provider): Response
    {
        $request->user()->favoriteProviders()->detach($provider->id);

        return response()->noContent();
    }
}
