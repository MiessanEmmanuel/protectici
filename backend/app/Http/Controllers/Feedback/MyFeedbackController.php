<?php

namespace App\Http\Controllers\Feedback;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Support\ApiPage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Dossiers « Dis-moi tout » envoyés par l'utilisateur connecté (rattachés à son compte à l'envoi). Comme le suivi
 * public : jamais de réponse interne, jamais de coordonnées. Un dossier d'autrui, ou envoyé sans compte, est en 404.
 */
class MyFeedbackController extends Controller
{
    public const STATUSES = ['new', 'in_progress', 'forwarded', 'resolved', 'closed'];

    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'status' => ['nullable', 'string', Rule::in(self::STATUSES)],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ]);

        $page = $this->mine($request)
            ->when($v['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null));

        return ApiPage::response($page, $page->getCollection()->map(fn (Feedback $f) => $this->resource($f))->all());
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json(['data' => $this->resource($this->mine($request)->findOrFail($id))]);
    }

    /** @return Builder<Feedback> */
    private function mine(Request $request)
    {
        return Feedback::query()->where('user_id', $request->user()->id)->with([
            'provider:id,slug,name', 'serviceType', 'topic',
            'replies' => fn ($q) => $q->where('is_internal', false)->orderBy('id'),
        ]);
    }

    /** @return array<string, mixed> */
    private function resource(Feedback $f): array
    {
        return [
            'id' => $f->id,
            'reference' => $f->reference,
            'status' => $f->status,
            'action_type' => $f->action_type,
            'target_type' => $f->target_type,
            'provider' => $f->provider === null ? null : ['slug' => $f->provider->slug, 'name' => $f->provider->name],
            'service_type' => $f->serviceType === null ? null : ['id' => $f->serviceType->id, 'slug' => $f->serviceType->slug, 'name' => $f->serviceType->name],
            'topic' => $f->topic === null ? null : ['id' => $f->topic->id, 'slug' => $f->topic->slug, 'name' => $f->topic->name],
            'comment' => $f->comment,
            'has_voice' => $f->hasVoice(),
            'created_at' => ApiPage::iso($f->created_at),
            'resolved_at' => ApiPage::iso($f->resolved_at),
            'replies' => $f->replies->map(fn (FeedbackReply $r) => [
                'body' => $r->body,
                'created_at' => ApiPage::iso($r->created_at),
            ])->values()->all(),
        ];
    }
}
