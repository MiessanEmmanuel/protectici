<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminReplyRequest;
use App\Http\Requests\Admin\ListFeedbacksRequest;
use App\Http\Requests\Admin\UpdateFeedbackRequest;
use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Models\User;
use App\Services\Feedback\FeedbackService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;

/** Administration des dossiers « Dis-moi tout » (contrat §8.2). Données personnelles : admin uniquement. */
class FeedbackController extends Controller
{
    public function index(ListFeedbacksRequest $request): JsonResponse
    {
        $v = $request->validated();
        $query = Feedback::query()->with(['provider:id,name', 'assignee:id,first_name,last_name']);

        foreach (['status', 'action_type'] as $column) {
            if (! empty($v[$column])) {
                $query->where($column, $v[$column]);
            }
        }
        if (! empty($v['provider'])) {
            $query->whereHas('provider', fn ($q) => ctype_digit($v['provider']) ? $q->where('providers.id', (int) $v['provider']) : $q->where('providers.slug', $v['provider']));
        }
        if (! empty($v['assigned_to'])) {
            $query->where('assigned_to', (int) $v['assigned_to']);
        }
        if (! empty($v['q'])) {
            $like = ApiPage::like(mb_strtolower($v['q']));
            $query->where(fn ($q) => $q
                ->whereRaw('lower(reference) like ?', [$like])
                ->orWhereRaw('lower(first_name) like ?', [$like])
                ->orWhereRaw('lower(last_name) like ?', [$like])
                ->orWhereRaw('lower(email::text) like ?', [$like]));
        }

        match ($v['sort'] ?? '-created_at') {
            'status' => $query->orderBy('status')->orderByDesc('id'),
            'created_at' => $query->orderBy('id'),
            default => $query->orderByDesc('id'),
        };

        $page = $query->paginate(ApiPage::perPage($v['per_page'] ?? null))->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Feedback $f) => $this->row($f))->all());
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->detail($this->find($id))]);
    }

    public function update(UpdateFeedbackRequest $request, int $id, FeedbackService $service): JsonResponse
    {
        $feedback = $service->update($this->find($id), $request->validated());

        return response()->json(['data' => $this->detail($this->find($feedback->id))]);
    }

    public function reply(AdminReplyRequest $request, int $id, FeedbackService $service): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $reply = $service->reply($this->find($id), $admin, $request->validated('body'), (bool) $request->validated('is_internal'));
        $reply->load('user:id,first_name,last_name');

        return response()->json(['data' => $this->replyRow($reply)], 201);
    }

    private function find(int $id): Feedback
    {
        return Feedback::query()
            ->with(['provider:id,name', 'assignee:id,first_name,last_name', 'serviceType', 'topic', 'replies.user:id,first_name,last_name'])
            ->findOrFail($id);
    }

    /** @return array<string, mixed> */
    private function row(Feedback $f): array
    {
        return [
            'id' => $f->id,
            'reference' => $f->reference,
            'author' => ['first_name' => $f->first_name, 'last_name' => $f->last_name, 'email' => $f->email],
            'provider' => $f->provider === null ? null : ['id' => $f->provider->id, 'name' => $f->provider->name],
            'action_type' => $f->action_type,
            'target_type' => $f->target_type,
            'status' => $f->status,
            'assigned_to' => $f->assignee === null ? null : ['id' => $f->assignee->id, 'name' => trim($f->assignee->first_name.' '.$f->assignee->last_name)],
            'created_at' => ApiPage::iso($f->created_at),
        ];
    }

    /** @return array<string, mixed> */
    private function detail(Feedback $f): array
    {
        return $this->row($f) + [
            'civility' => $f->civility,
            'phone' => $f->phone,
            'service_type' => $f->serviceType === null ? null : ['id' => $f->serviceType->id, 'slug' => $f->serviceType->slug, 'name' => $f->serviceType->name],
            'topic' => $f->topic === null ? null : ['id' => $f->topic->id, 'slug' => $f->topic->slug, 'name' => $f->topic->name],
            'product_type' => $f->product_type,
            'location' => $f->location,
            'comment' => $f->comment,
            'consent_at' => ApiPage::iso($f->consent_at),
            'resolved_at' => ApiPage::iso($f->resolved_at),
            'replies' => $f->replies->sortBy('id')->map(fn (FeedbackReply $r) => $this->replyRow($r))->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function replyRow(FeedbackReply $r): array
    {
        return [
            'id' => $r->id,
            'author' => $r->user === null ? null : ['id' => $r->user->id, 'name' => trim($r->user->first_name.' '.$r->user->last_name)],
            'body' => $r->body,
            'is_internal' => $r->is_internal,
            'sent_at' => ApiPage::iso($r->sent_at),
            'created_at' => ApiPage::iso($r->created_at),
        ];
    }
}
