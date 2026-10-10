<?php

namespace App\Http\Controllers\Reviews;

use App\Exceptions\ApiHttpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reviews\StoreReviewRequest;
use App\Http\Requests\Reviews\UpdateReviewRequest;
use App\Http\Resources\Reviews\ReviewPresenter;
use App\Models\Provider;
use App\Models\Review;
use App\Models\User;
use App\Services\Reviews\ReviewService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Avis de l'utilisateur connecté (contrat §8.1). Un avis d'autrui se résout toujours en 404. */
class ReviewController extends Controller
{
    public function __construct(private readonly ReviewService $reviews) {}

    public function store(StoreReviewRequest $request, Provider $publishedProvider): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // 409 avant la Policy : un doublon doit être signalé même à un propriétaire ou à un compte restreint.
        if ($this->reviews->alreadyReviewed($publishedProvider, $user)) {
            throw new ApiHttpException(409, 'Vous avez déjà donné un avis pour ce prestataire.');
        }
        // Le message de la Policy n'est pas relayé par le gestionnaire d'erreurs : refus explicite du propriétaire.
        if ($publishedProvider->user_id !== null && $publishedProvider->user_id === $user->id) {
            throw new ApiHttpException(403, 'Vous ne pouvez pas donner d\'avis sur votre propre fiche.');
        }
        Gate::forUser($user)->authorize('create', [Review::class, $publishedProvider]);

        $review = $this->reviews->create($publishedProvider, $user, $request->validated());

        return response()->json(['data' => ReviewPresenter::mine($review->load('provider'))], 201);
    }

    public function mine(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $page = Review::query()
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->with('provider:id,slug,name')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($request->query('per_page')))
            ->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Review $r) => ReviewPresenter::mine($r))->all());
    }

    public function update(UpdateReviewRequest $request, int $id): JsonResponse
    {
        $review = $this->ownReview($request, $id);
        $updated = $this->reviews->update($review, $request->validated());

        return response()->json(['data' => ReviewPresenter::mine($updated->load('provider'))]);
    }

    public function destroy(Request $request, int $id): Response
    {
        $this->reviews->delete($this->ownReview($request, $id));

        return response()->noContent();
    }

    private function ownReview(Request $request, int $id): Review
    {
        /** @var User $user */
        $user = $request->user();

        $review = Review::query()->with('provider:id,slug,name')->where('user_id', $user->id)->findOrFail($id);
        Gate::forUser($user)->authorize('edit', $review);

        return $review;
    }
}
