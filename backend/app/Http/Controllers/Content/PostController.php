<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\ListPostsRequest;
use App\Http\Requests\Content\SavePostRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\Post;
use App\Models\User;
use App\Services\Content\PostService;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Articles du back-office (editor + admin) : tous statuts, jamais de donnée personnelle (nom d'auteur abrégé). */
class PostController extends Controller
{
    private const RELATIONS = ['category:id,slug,name', 'author:id,first_name,last_name', 'cover'];

    public function __construct(private readonly PostService $posts) {}

    public function index(ListPostsRequest $request): JsonResponse
    {
        Gate::authorize('content-area');
        $v = $request->validated();

        $query = Post::query()->with(self::RELATIONS)
            ->when($v['status'] ?? null, fn ($q, $s) => $q->where('posts.status', $s))
            ->when($v['category'] ?? null, fn ($q, $c) => $q->whereHas('category', fn ($cq) => $cq->where('slug', $c)))
            ->when($v['q'] ?? null, fn ($q, $term) => $q->where('posts.title', 'ilike', ApiPage::like($term)));

        $page = $query->orderByDesc('posts.updated_at')->orderByDesc('posts.id')
            ->paginate(ApiPage::perPage($v['per_page'] ?? null))->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Post $p) => BlogPresenter::adminPost($p, false))->all());
    }

    public function show(int $id): JsonResponse
    {
        Gate::authorize('content-area');

        return response()->json(['data' => BlogPresenter::adminPost($this->find($id), true)]);
    }

    public function store(SavePostRequest $request): JsonResponse
    {
        Gate::authorize('content-area');
        $post = $this->posts->create($this->actor($request), $request->validated());

        return response()->json(['data' => BlogPresenter::adminPost($this->find($post->id), true)], 201);
    }

    public function update(SavePostRequest $request, int $id): JsonResponse
    {
        Gate::authorize('content-area');
        $post = $this->posts->update($this->actor($request), $this->find($id), $request->validated());

        return response()->json(['data' => BlogPresenter::adminPost($this->find($post->id), true)]);
    }

    public function destroy(Request $request, int $id): Response
    {
        Gate::authorize('content-area');
        $this->posts->delete($this->actor($request), $this->find($id));

        return response()->noContent();
    }

    private function find(int $id): Post
    {
        return Post::query()->with(self::RELATIONS)->findOrFail($id);
    }

    private function actor(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
