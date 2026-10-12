<?php

namespace App\Http\Controllers\Content;

use App\Http\Controllers\Controller;
use App\Http\Requests\Content\SavePageRequest;
use App\Models\Page;
use App\Models\User;
use App\Services\Content\EditorialAdministration;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Pages institutionnelles : lecture editor + admin ; écriture admin uniquement (pages légales). */
class PageController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('content-area');

        return response()->json(['data' => Page::query()->orderBy('title')->get()->map(fn (Page $p) => $this->row($p, false))->all()]);
    }

    public function show(string $slug): JsonResponse
    {
        Gate::authorize('content-area');

        return response()->json(['data' => $this->row(Page::query()->where('slug', $slug)->firstOrFail(), true)]);
    }

    public function update(SavePageRequest $request, string $slug, EditorialAdministration $admin): JsonResponse
    {
        Gate::authorize('admin-area');
        /** @var User $actor */
        $actor = $request->user();
        $page = $admin->savePage($actor, Page::query()->where('slug', $slug)->firstOrFail(), $request->validated());

        return response()->json(['data' => $this->row($page, true)]);
    }

    /** @return array<string, mixed> */
    private function row(Page $p, bool $withBody): array
    {
        $row = [
            'slug' => $p->slug, 'title' => $p->title, 'seo_title' => $p->seo_title, 'seo_description' => $p->seo_description,
            'is_visible' => $p->is_visible, 'updated_at' => ApiPage::iso($p->updated_at),
        ];

        return $withBody ? $row + ['body' => $p->body] : $row;
    }
}
