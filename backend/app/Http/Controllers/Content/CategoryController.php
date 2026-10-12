<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\SaveCategoryRequest;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use App\Services\Content\EditorialAdministration;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Catégories du blog (editor + admin) : lecture et modification ; création/suppression restent dans /admin/reference. */
class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('content-area');
        $counts = Post::query()->selectRaw('category_id, count(*) as n')->groupBy('category_id')->pluck('n', 'category_id');

        return response()->json(['data' => PostCategory::query()->ordered()->get()->map(fn (PostCategory $c) => $this->row($c, (int) ($counts[$c->id] ?? 0)))->all()]);
    }

    public function show(int $id): JsonResponse
    {
        Gate::authorize('content-area');
        $category = PostCategory::query()->findOrFail($id);

        return response()->json(['data' => $this->row($category, Post::query()->where('category_id', $id)->count())]);
    }

    public function update(SaveCategoryRequest $request, int $id, EditorialAdministration $admin): JsonResponse
    {
        Gate::authorize('content-area');
        /** @var User $actor */
        $actor = $request->user();
        $category = $admin->saveCategory($actor, PostCategory::query()->findOrFail($id), $request->validated());

        return response()->json(['data' => $this->row($category, Post::query()->where('category_id', $id)->count())]);
    }

    /** @return array<string, mixed> */
    private function row(PostCategory $c, int $posts): array
    {
        return ['id' => $c->id, 'slug' => $c->slug, 'name' => $c->name, 'description' => $c->description, 'sort_order' => $c->sort_order, 'is_visible' => $c->is_visible, 'posts_count' => $posts];
    }
}
