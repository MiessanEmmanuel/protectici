<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\ListSubscribersRequest;
use App\Models\NewsletterSubscriber;
use App\Services\AuditLogger;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Abonnés de la lettre d'information (admin + 2FA) : e-mails visibles, consultation tracée. */
class NewsletterSubscriberController extends Controller
{
    public function index(ListSubscribersRequest $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('admin-area');
        $v = $request->validated();

        $page = NewsletterSubscriber::query()
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($v['q'] ?? null, fn ($q, $term) => $q->where('email', 'ilike', ApiPage::like($term)))
            ->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null))->withQueryString();

        $audit->record('newsletter_subscribers_listed', null, context: ['page' => $page->currentPage(), 'status' => $v['status'] ?? null, 'search' => isset($v['q'])]);

        return ApiPage::response($page, $page->getCollection()->map(fn (NewsletterSubscriber $s) => [
            'id' => $s->id,
            'email' => $s->email,
            'status' => $s->status,
            'source' => $s->source,
            'consent_at' => ApiPage::iso($s->consent_at),
            'confirmed_at' => ApiPage::iso($s->confirmed_at),
            'unsubscribed_at' => ApiPage::iso($s->unsubscribed_at),
            'created_at' => ApiPage::iso($s->created_at),
        ])->all());
    }
}
