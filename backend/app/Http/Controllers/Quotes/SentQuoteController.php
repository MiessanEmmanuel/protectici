<?php

namespace App\Http\Controllers\Quotes;

use App\Http\Controllers\Controller;
use App\Http\Resources\Quotes\QuoteResources;
use App\Models\QuoteRequest;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Suivi des demandes de devis envoyées par l'utilisateur connecté (rattachées à son compte à l'envoi).
 * Une demande d'autrui, ou envoyée sans être connecté, se résout en 404.
 */
class SentQuoteController extends Controller
{
    private const WITH = ['serviceType', 'city', 'district', 'recipients.provider:id,slug,name'];

    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'status' => ['nullable', 'string', Rule::in(QuoteRequest::STATUSES)],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $page = QuoteRequest::query()->where('user_id', $request->user()->id)->with(self::WITH)
            ->when($v['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null));

        return ApiPage::response($page, $page->getCollection()->map(fn (QuoteRequest $q) => QuoteResources::sentQuote($q))->all());
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $quote = QuoteRequest::query()->where('user_id', $request->user()->id)->with(self::WITH)->findOrFail($id);

        return response()->json(['data' => QuoteResources::sentQuote($quote)]);
    }
}
