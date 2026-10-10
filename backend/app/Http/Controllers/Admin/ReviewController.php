<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Establishment\ReasonRequest;
use App\Http\Requests\Reviews\ListReviewsRequest;
use App\Http\Resources\Reviews\ReviewPresenter;
use App\Models\Review;
use App\Models\User;
use App\Services\Reviews\ReviewModeration;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Modération des avis (contrat §8.1) : rôle admin + 2FA, vérifié par le groupe de routes ET par Gate. */
class ReviewController extends Controller
{
    public function __construct(private readonly ReviewModeration $moderation) {}

    public function index(ListReviewsRequest $request): JsonResponse
    {
        Gate::authorize('admin-area');
        $v = $request->validated();

        $query = Review::query()
            ->with(['provider:id,slug,name', 'user:id,first_name,last_name,email'])
            ->withCount('reports')
            ->where('status', $v['status'] ?? 'pending');

        if (! empty($v['provider'])) {
            $query->whereHas('provider', fn ($q) => $q->where('slug', $v['provider']));
        }
        if (! empty($v['q'])) {
            $like = ApiPage::like($v['q']);
            $query->where(function ($q) use ($like) {
                $q->where('title', 'ilike', $like)
                    ->orWhere('body', 'ilike', $like)
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'ilike', $like));
            });
        }

        $page = $query->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null))
            ->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Review $r) => ReviewPresenter::adminRow($r))->all());
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        Gate::authorize('admin-area');

        return $this->respond($this->moderation->approve($id, $this->admin($request)));
    }

    public function reject(ReasonRequest $request, int $id): JsonResponse
    {
        return $this->respond($this->moderation->reject($id, $this->admin($request), $request->validated('reason')));
    }

    public function destroy(Request $request, int $id): Response
    {
        Gate::authorize('admin-area');
        Review::query()->findOrFail($id);
        $this->moderation->delete($id, $this->admin($request));

        return response()->noContent();
    }

    private function respond(Review $review): JsonResponse
    {
        $review->load(['provider:id,slug,name', 'user:id,first_name,last_name,email'])->loadCount('reports');

        return response()->json(['data' => ReviewPresenter::adminRow($review)]);
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }
}
