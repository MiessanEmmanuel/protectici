<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reviews\ListReviewReportsRequest;
use App\Http\Resources\Reviews\ReviewPresenter;
use App\Models\ReviewReport;
use App\Models\User;
use App\Services\Reviews\ReviewModeration;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Traitement des signalements d'avis (contrat §8.1). */
class ReviewReportController extends Controller
{
    public function __construct(private readonly ReviewModeration $moderation) {}

    public function index(ListReviewReportsRequest $request): JsonResponse
    {
        Gate::authorize('admin-area');
        $v = $request->validated();

        $page = ReviewReport::query()
            ->with(['review.provider:id,name', 'reporter:id,first_name,last_name'])
            ->whereHas('review')
            ->where('status', $v['status'] ?? 'open')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null))
            ->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (ReviewReport $r) => ReviewPresenter::adminReport($r))->all());
    }

    public function accept(Request $request, int $id): JsonResponse
    {
        Gate::authorize('admin-area');

        return $this->respond($this->moderation->acceptReport($id, $this->admin($request)));
    }

    public function dismiss(Request $request, int $id): JsonResponse
    {
        Gate::authorize('admin-area');

        return $this->respond($this->moderation->dismissReport($id, $this->admin($request)));
    }

    private function respond(ReviewReport $report): JsonResponse
    {
        $report->load(['review.provider:id,name', 'reporter:id,first_name,last_name']);

        return response()->json(['data' => ReviewPresenter::adminReport($report)]);
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }
}
