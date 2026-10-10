<?php

namespace App\Http\Controllers\Quotes;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quotes\DeclineQuoteRequest;
use App\Http\Requests\Quotes\ReplyQuoteRequest;
use App\Http\Resources\Quotes\QuoteResources;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\User;
use App\Services\Quotes\QuoteService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Boîte de réception des devis d'un prestataire (contrat §8.3). L'`id` d'un ProviderQuote est l'identifiant du
 * DESTINATAIRE (quote_request_recipients.id). Un devis adressé à une autre fiche se résout en 404.
 */
class ProviderQuoteController extends Controller
{
    private const WITH = ['provider:id,slug,name', 'quoteRequest.serviceType', 'quoteRequest.city', 'quoteRequest.district'];

    public function index(Request $request): JsonResponse
    {
        $user = $this->actor($request);
        $v = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['sent', 'viewed', 'replied', 'declined'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $page = QuoteRequestRecipient::query()->inbox($user)->with(self::WITH)
            ->when($v['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('sent_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null));

        return ApiPage::response($page, $page->getCollection()->map(fn (QuoteRequestRecipient $r) => QuoteResources::providerQuote($r))->all());
    }

    public function show(Request $request, int $id, QuoteService $quotes): JsonResponse
    {
        $user = $this->actor($request);
        $recipient = QuoteRequestRecipient::query()->inbox($user)->with(self::WITH)->findOrFail($id);
        Gate::authorize('receive', [$recipient->quoteRequest, $recipient]);

        if ($recipient->status === 'sent') {
            $quotes->markViewed($recipient);
            $recipient->refresh();
        }

        return response()->json(['data' => QuoteResources::providerQuote($recipient)]);
    }

    public function reply(ReplyQuoteRequest $request, int $id, QuoteService $quotes): JsonResponse
    {
        $user = $this->actor($request);
        $this->authorizeRecipient($user, $id);
        $recipient = $quotes->reply($id, $user, $request->validated('message'), $request->validated('quoted_amount'));

        return $this->respond($recipient);
    }

    public function decline(DeclineQuoteRequest $request, int $id, QuoteService $quotes): JsonResponse
    {
        $user = $this->actor($request);
        $this->authorizeRecipient($user, $id);
        $recipient = $quotes->decline($id, $user, $request->validated('reason'));

        return $this->respond($recipient);
    }

    private function actor(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('inbox', QuoteRequest::class);

        return $user;
    }

    /** 404 si le destinataire n'appartient pas à l'utilisateur (avant toute écriture). */
    private function authorizeRecipient(User $user, int $id): void
    {
        $recipient = QuoteRequestRecipient::query()->inbox($user)->with('quoteRequest')->findOrFail($id);
        Gate::authorize('receive', [$recipient->quoteRequest, $recipient]);
    }

    private function respond(QuoteRequestRecipient $recipient): JsonResponse
    {
        $recipient->load(self::WITH);

        return response()->json(['data' => QuoteResources::providerQuote($recipient)]);
    }
}
