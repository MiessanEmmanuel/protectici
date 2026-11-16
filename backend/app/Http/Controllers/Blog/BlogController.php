<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Blog\ListPostsRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\Post;
use App\Models\PostCategory;
use App\Services\Content\BlogQueries;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Blog public (contrat §9.1). */
class BlogController extends Controller
{
    public function __construct(private readonly BlogQueries $queries) {}

    public function categories(): JsonResponse
    {
        $counts = $this->queries->published()->reorder()->selectRaw('posts.category_id, count(*) as n')->groupBy('posts.category_id')->pluck('n', 'category_id');

        $rows = PostCategory::query()->visible()->ordered()->get()->map(fn (PostCategory $c) => [
            'slug' => $c->slug,
            'name' => $c->name,
            'description' => $c->description,
            'posts_count' => (int) ($counts[$c->id] ?? 0),
        ])->all();

        return response()->json(['data' => $rows]);
    }

    public function index(ListPostsRequest $request): JsonResponse
    {
        $v = $request->validated();
        $page = $this->queries->listing($v)->paginate(max(1, min(24, (int) ($v['per_page'] ?? 12))))->withQueryString();

        return ApiPage::response($page, $page->getCollection()->map(fn (Post $p) => BlogPresenter::card($p))->all());
    }

    /** Lecture sans effet de bord : le rendu serveur de Next.js arrive d'une seule IP, la vue est comptée par recordView. */
    public function show(string $slug): JsonResponse
    {
        $post = $this->queries->published()->with(BlogPresenter::CARD_RELATIONS)->where('posts.slug', $slug)->firstOrFail();

        return response()->json(['data' => BlogPresenter::detail($post, $this->queries->related($post))]);
    }

    /** Compteur de vues appelé par le navigateur (comme les fiches prestataires) : dédoublonné par IP hachée, 30 min. */
    public function recordView(Request $request, string $slug): Response
    {
        $post = $this->queries->published()->where('posts.slug', $slug)->firstOrFail(['posts.id', 'posts.views_count']);
        $this->queries->countView($post, $request->ip());

        return response()->noContent();
    }

    public function flash(): JsonResponse
    {
        return response()->json(['data' => $this->queries->flash()->map(fn (Post $p) => [
            'slug' => $p->slug, 'title' => $p->title, 'published_at' => ApiPage::iso($p->published_at),
        ])->all()]);
    }
}
