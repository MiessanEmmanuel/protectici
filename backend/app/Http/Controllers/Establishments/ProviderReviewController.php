<?php

namespace App\Http\Controllers\Establishments;

use App\Enums\EstablishmentType;
use App\Http\Requests\Reviews\ListReviewsRequest;
use App\Http\Requests\Reviews\ReplyReviewRequest;
use App\Http\Resources\Reviews\ReviewPresenter;
use App\Models\Provider;
use App\Models\Review;
use App\Models\User;
use App\Services\Reviews\ReviewService;
use App\Support\ApiPage;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Avis reçus par une fiche prestataire dont l'utilisateur est propriétaire (contrat §8.1).
 * Écart assumé : seuls les avis publiés (approuvés ET visibles) sont listés, même si `status` demande autre chose ;
 * le filtre `status` ne fait que restreindre cet ensemble.
 */
class ProviderReviewController extends OwnerController
{
    public function index(ListReviewsRequest $request, string $slug): JsonResponse
    {
        $provider = $this->ownedProvider($request, $slug);

        $query = Review::query()->published()->where('reviews.provider_id', $provider->id)
            ->with('user:id,first_name,last_name');
        if ($request->filled('status')) {
            $query->where('reviews.status', $request->validated('status'));
        }

        $page = $query->orderByDesc('reviews.created_at')->orderByDesc('reviews.id')
            ->paginate(ApiPage::perPage($request->validated('per_page') ?? null))
            ->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Review $r) => ReviewPresenter::received($r))->all());
    }

    public function reply(ReplyReviewRequest $request, string $slug, int $id, ReviewService $reviews): JsonResponse
    {
        $provider = $this->ownedProvider($request, $slug);
        /** @var User $user */
        $user = $request->user();

        $review = $reviews->reply($provider, $id, $user, $request->validated('body'));

        return response()->json(['data' => ReviewPresenter::received($review)]);
    }

    private function ownedProvider(Request $request, string $slug): Provider
    {
        $provider = $this->owned($request, EstablishmentType::Provider->value, $slug);
        if (! $provider instanceof Provider) {
            throw new ModelNotFoundException;
        }

        return $provider;
    }
}
