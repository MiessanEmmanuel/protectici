<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Blog\PageParamsRequest;
use App\Http\Requests\Blog\StoreCommentRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\PostComment;
use App\Services\Content\BlogQueries;
use App\Services\Content\CommentService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;

/** Commentaires publics d'un article (contrat §9.1) : lecture des approuvés, dépôt modéré par un compte vérifié. */
class CommentController extends Controller
{
    public function __construct(private readonly BlogQueries $queries) {}

    public function index(PageParamsRequest $request, string $slug): JsonResponse
    {
        $post = $this->queries->published()->where('posts.slug', $slug)->firstOrFail();

        $page = PostComment::query()
            ->with([
                'user:id,first_name,last_name',
                'replies' => fn ($q) => $q->where('is_visible', true)->orderBy('created_at')->orderBy('id'),
                'replies.user:id,first_name,last_name',
            ])
            ->where('post_id', $post->id)->whereNull('parent_id')->where('is_visible', true)
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(ApiPage::perPage($request->validated('per_page')))->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (PostComment $c) => BlogPresenter::comment($c, true))->all());
    }

    public function store(StoreCommentRequest $request, string $slug, CommentService $service): JsonResponse
    {
        $post = $this->queries->published()->where('posts.slug', $slug)->firstOrFail();

        // Champ piège rempli : succès simulé identique, rien n'est enregistré.
        if (! $request->isBot()) {
            $service->create($request->user(), $post, $request->commentData(), $request->idempotencyKey());
        }

        return response()->json(['data' => ['status' => 'pending']], 201);
    }
}
