<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminReplyRequest;
use App\Http\Requests\Admin\ListContactMessagesRequest;
use App\Http\Requests\Admin\UpdateContactMessageRequest;
use App\Models\ContactMessage;
use App\Models\User;
use App\Services\Contact\ContactService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;

/** Administration des messages de contact (contrat §8.4). */
class ContactMessageController extends Controller
{
    public function index(ListContactMessagesRequest $request): JsonResponse
    {
        $v = $request->validated();
        $query = ContactMessage::query()->where('status', $v['status'] ?? 'new');

        if (! empty($v['q'])) {
            $like = ApiPage::like(mb_strtolower($v['q']));
            $query->where(fn ($q) => $q
                ->whereRaw('lower(name) like ?', [$like])
                ->orWhereRaw('lower(email::text) like ?', [$like])
                ->orWhereRaw('lower(subject) like ?', [$like]));
        }

        $page = $query->orderByDesc('id')->paginate(ApiPage::perPage($v['per_page'] ?? null))->withQueryString();
        $handlers = User::query()->whereIn('id', $page->getCollection()->pluck('handled_by')->filter()->unique())->get(['id', 'first_name', 'last_name'])->keyBy('id');

        return ApiPage::response($page, $page->getCollection()->map(fn (ContactMessage $m) => $this->row($m, $handlers[$m->handled_by] ?? null))->all());
    }

    public function update(UpdateContactMessageRequest $request, int $id, ContactService $service): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $message = $service->updateStatus(ContactMessage::query()->findOrFail($id), $request->validated('status'), $admin);

        return response()->json(['data' => $this->row($message, $this->handler($message))]);
    }

    public function reply(AdminReplyRequest $request, int $id, ContactService $service): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $message = $service->reply(ContactMessage::query()->findOrFail($id), $admin, $request->validated('body'));

        return response()->json(['data' => $this->row($message, $admin)]);
    }

    private function handler(ContactMessage $message): ?User
    {
        return $message->handled_by === null ? null : User::query()->find($message->handled_by, ['id', 'first_name', 'last_name']);
    }

    /** @return array<string, mixed> */
    private function row(ContactMessage $m, ?User $handler): array
    {
        return [
            'id' => $m->id,
            'name' => $m->name,
            'email' => $m->email,
            'subject' => $m->subject,
            'message' => $m->message,
            'status' => $m->status,
            'handled_by' => $handler === null ? null : ['id' => $handler->id, 'name' => trim($handler->first_name.' '.$handler->last_name)],
            'handled_at' => ApiPage::iso($m->handled_at),
            'created_at' => ApiPage::iso($m->created_at),
        ];
    }
}
