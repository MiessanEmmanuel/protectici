<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\ListCommentsRequest;
use App\Http\Requests\Content\ModerateCommentRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\PostComment;
use App\Models\User;
use App\Services\Content\CommentService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Modération des commentaires (editor + admin). L'auteur n'est identifié que par « Prénom N. » (pas d'e-mail). */
class CommentController extends Controller
{
    public function index(ListCommentsRequest $request): JsonResponse
    {
        Gate::authorize('content-area');
        $v = $request->validated();

        $page = PostComment::query()->with(['user:id,first_name,last_name', 'post:id,slug,title'])
            ->whereHas('post')
            ->where('status', $v['status'] ?? 'pending')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null))->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (PostComment $c) => $this->row($c))->all());
    }

    public function update(ModerateCommentRequest $request, int $id, CommentService $service): JsonResponse
    {
        Gate::authorize('content-area');
        /** @var User $actor */
        $actor = $request->user();
        $comment = $service->moderate($actor, PostComment::query()->whereHas('post')->findOrFail($id), $request->validated('status'));

        return response()->json(['data' => $this->row($comment->load(['user:id,first_name,last_name', 'post:id,slug,title']))]);
    }

    /** @return array<string, mixed> */
    private function row(PostComment $c): array
    {
        return [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'body' => $c->body,
            'status' => $c->status,
            'author_name' => BlogPresenter::authorName($c->user) ?? 'Utilisateur',
            'post' => $c->post === null ? null : ['id' => $c->post->id, 'slug' => $c->post->slug, 'title' => $c->post->title],
            'created_at' => ApiPage::iso($c->created_at),
            'moderated_at' => ApiPage::iso($c->moderated_at),
        ];
    }
}
