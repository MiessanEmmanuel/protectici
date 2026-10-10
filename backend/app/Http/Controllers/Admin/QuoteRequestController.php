<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quotes\DispatchQuoteRequest;
use App\Http\Requests\Quotes\UpdateQuoteStatusRequest;
use App\Http\Resources\Quotes\QuoteResources;
use App\Models\QuoteRequest;
use App\Models\User;
use App\Services\Quotes\QuoteService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Administration des demandes de devis (contrat §8.3). */
class QuoteRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('manage', QuoteRequest::class);
        $v = $request->validate([
            'status' => ['nullable', 'string', Rule::in(QuoteRequest::STATUSES)],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', Rule::in(['created_at', '-created_at'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $term = isset($v['q']) ? trim($v['q']) : '';
        $page = QuoteRequest::query()->with(['serviceType', 'city'])->withCount('recipients')
            ->when($v['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($term !== '', function ($q) use ($term) {
                $like = ApiPage::like($term);
                $q->where(fn ($w) => $w->whereRaw("reference ILIKE ? ESCAPE '\\'", [$like])
                    ->orWhereRaw("email::text ILIKE ? ESCAPE '\\'", [$like])
                    ->orWhereRaw("(first_name || ' ' || last_name) ILIKE ? ESCAPE '\\'", [$like])
                    ->orWhereRaw("(last_name || ' ' || first_name) ILIKE ? ESCAPE '\\'", [$like]));
            })
            ->orderBy('created_at', ($v['sort'] ?? '-created_at') === 'created_at' ? 'asc' : 'desc')
            ->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null));

        return ApiPage::response($page, $page->getCollection()->map(fn (QuoteRequest $q) => QuoteResources::adminRow($q))->all());
    }

    public function show(int $id): JsonResponse
    {
        Gate::authorize('manage', QuoteRequest::class);

        return response()->json(['data' => QuoteResources::adminDetail(QuoteRequest::query()->withCount('recipients')->findOrFail($id))]);
    }

    public function dispatch(DispatchQuoteRequest $request, int $id, QuoteService $quotes): JsonResponse
    {
        Gate::authorize('manage', QuoteRequest::class);
        /** @var User $admin */
        $admin = $request->user();
        $quote = $quotes->dispatch($id, array_map('intval', $request->validated('provider_ids')), $admin);

        return response()->json(['data' => QuoteResources::adminDetail($quote->loadCount('recipients'))]);
    }

    public function update(UpdateQuoteStatusRequest $request, int $id, QuoteService $quotes): JsonResponse
    {
        Gate::authorize('manage', QuoteRequest::class);
        /** @var User $admin */
        $admin = $request->user();
        $quote = $quotes->changeStatus($id, $request->validated('status'), $admin);

        return response()->json(['data' => QuoteResources::adminDetail($quote->loadCount('recipients'))]);
    }
}
