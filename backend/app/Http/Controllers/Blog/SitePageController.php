<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Blog\ListPartnersRequest;
use App\Http\Resources\Content\BlogPresenter;
use App\Models\Page;
use App\Models\Partner;
use App\Services\Content\SiteSettings;
use App\Support\ApiPage;
use Illuminate\Http\JsonResponse;

/** Pages institutionnelles, partenaires/clients et paramètres publics (contrat §9.1). */
class SitePageController extends Controller
{
    public function page(string $slug): JsonResponse
    {
        $page = Page::query()->where('slug', $slug)->where('is_visible', true)->firstOrFail();

        return response()->json(['data' => [
            'slug' => $page->slug,
            'title' => $page->title,
            'body' => $page->body,
            'seo_title' => $page->seo_title,
            'seo_description' => $page->seo_description,
            'updated_at' => ApiPage::iso($page->updated_at),
        ]]);
    }

    public function partners(ListPartnersRequest $request): JsonResponse
    {
        $rows = Partner::query()->with('logo')->where('is_visible', true)
            ->when($request->validated('type'), fn ($q, $type) => $q->where('type', $type))
            ->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $rows->map(fn (Partner $p) => BlogPresenter::partner($p))->all()]);
    }

    public function settings(SiteSettings $settings): JsonResponse
    {
        return response()->json(['data' => (object) $settings->publicMap()]);
    }
}
