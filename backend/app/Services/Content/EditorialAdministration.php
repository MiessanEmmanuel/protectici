<?php

namespace App\Services\Content;

use App\Models\Page;
use App\Models\Partner;
use App\Models\PostCategory;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PlainText;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Écriture des pages, partenaires/clients et catégories du blog (contrat §9.2), avec audit à chaque changement. */
class EditorialAdministration
{
    public function __construct(
        private readonly HtmlSanitizer $sanitizer,
        private readonly AuditLogger $audit,
        private readonly ContentMediaService $media,
    ) {}

    /** @param array<string, mixed> $data title, body, seo_title?, seo_description?, is_visible */
    public function savePage(User $actor, Page $page, array $data): Page
    {
        return DB::transaction(function () use ($actor, $page, $data) {
            $old = ['title' => $page->title, 'is_visible' => $page->is_visible];
            $body = $this->sanitizer->clean((string) $data['body']);
            if ($data['is_visible'] && $this->sanitizer->plainText($body) === '') {
                throw ValidationException::withMessages(['body' => ['Une page publiée doit avoir un contenu.']]);
            }

            $page->fill([
                'title' => PlainText::single($data['title']),
                'body' => $body,
                'seo_title' => isset($data['seo_title']) ? PlainText::single($data['seo_title']) : null,
                'seo_description' => isset($data['seo_description']) ? PlainText::single($data['seo_description']) : null,
            ]);
            $page->forceFill(['is_visible' => (bool) $data['is_visible'], 'updated_by' => $actor->id])->save();

            $this->audit->record('page_updated', $page, $old, ['title' => $page->title, 'is_visible' => $page->is_visible], actor: $actor);

            return $page;
        });
    }

    /** @param array<string, mixed> $data */
    public function savePartner(User $actor, Partner $partner, array $data): Partner
    {
        return DB::transaction(function () use ($actor, $partner, $data) {
            $old = $partner->exists ? ['name' => $partner->name, 'type' => $partner->type, 'is_visible' => $partner->is_visible] : null;

            $fill = array_intersect_key($data, array_flip(['type', 'name', 'website_url', 'description', 'sort_order']));
            foreach (['name', 'website_url'] as $field) {
                if (array_key_exists($field, $fill)) {
                    $fill[$field] = $fill[$field] === null ? null : PlainText::single($fill[$field]);
                }
            }
            if (array_key_exists('description', $fill)) {
                $fill['description'] = $fill['description'] === null ? null : PlainText::multiline($fill['description']);
            }
            $partner->fill($fill);
            if (! $partner->exists) {
                $partner->sort_order ??= 0;
                $partner->forceFill(['is_visible' => (bool) ($data['is_visible'] ?? false)]);
            } elseif (array_key_exists('is_visible', $data)) {
                $partner->forceFill(['is_visible' => (bool) $data['is_visible']]);
            }
            $partner->save();

            if (array_key_exists('logo_media_id', $data)) {
                $this->media->attach($partner, $actor, $data['logo_media_id'], 'logo', 'logo_media_id');
            }

            $this->audit->record($old === null ? 'partner_created' : 'partner_updated', $partner, $old, ['name' => $partner->name, 'type' => $partner->type, 'is_visible' => $partner->is_visible], actor: $actor);

            return $partner;
        });
    }

    public function deletePartner(User $actor, Partner $partner): void
    {
        DB::transaction(function () use ($actor, $partner) {
            $partner->forceFill(['is_visible' => false])->save();
            $partner->delete();
            $this->audit->record('partner_deleted', $partner, ['name' => $partner->name], actor: $actor);
        });
    }

    /** @param array<string, mixed> $data */
    public function saveCategory(User $actor, PostCategory $category, array $data): PostCategory
    {
        return DB::transaction(function () use ($actor, $category, $data) {
            $old = ['name' => $category->name, 'sort_order' => $category->sort_order, 'is_visible' => $category->is_visible];

            $fill = array_intersect_key($data, array_flip(['name', 'description', 'sort_order']));
            foreach (['name', 'description'] as $field) {
                if (array_key_exists($field, $fill)) {
                    $fill[$field] = $fill[$field] === null ? null : PlainText::single($fill[$field]);
                }
            }
            $category->fill($fill);
            if (array_key_exists('is_visible', $data)) {
                $category->forceFill(['is_visible' => (bool) $data['is_visible']]);
            }
            $category->save();

            $this->audit->record('post_category_updated', $category, $old, ['name' => $category->name, 'sort_order' => $category->sort_order, 'is_visible' => $category->is_visible], actor: $actor);

            return $category;
        });
    }
}
