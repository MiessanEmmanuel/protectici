<?php

namespace App\Services\Content;

use App\Models\Post;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PlainText;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Cycle de vie des articles (contrat §9.2) : HTML nettoyé par liste blanche, slug unique figé à la création,
 * durée de lecture calculée, règles de publication (brouillon / planifié / publié / archivé) appliquées de façon
 * centralisée. Chaque écriture est tracée dans audit_logs (jamais le corps de l'article).
 */
class PostService
{
    public function __construct(
        private readonly HtmlSanitizer $sanitizer,
        private readonly AuditLogger $audit,
        private readonly ContentMediaService $media,
    ) {}

    /** @param array<string, mixed> $data données validées */
    public function create(User $actor, array $data): Post
    {
        return DB::transaction(function () use ($actor, $data) {
            $post = new Post;
            $this->fillContent($post, $data);
            $post->slug = $this->uniqueSlug((string) $data['title']);
            $post->forceFill(['author_id' => $actor->id]);
            $this->applyPublication($post, $data);
            $this->applyFlags($post, $data);
            $post->save();
            if (($data['cover_media_id'] ?? null) !== null) {
                $this->media->attach($post, $actor, $data['cover_media_id'], 'cover', 'cover_media_id');
            }

            $this->audit->record('post_created', $post, null, $this->snapshot($post), actor: $actor);

            return $post;
        });
    }

    /** @param array<string, mixed> $data données validées (partielles) */
    public function update(User $actor, Post $post, array $data): Post
    {
        return DB::transaction(function () use ($actor, $post, $data) {
            $old = $this->snapshot($post);
            $this->fillContent($post, $data);
            $this->applyPublication($post, $data);
            $this->applyFlags($post, $data);
            $post->save();
            if (array_key_exists('cover_media_id', $data)) {
                $this->media->attach($post, $actor, $data['cover_media_id'], 'cover', 'cover_media_id');
            }

            $this->audit->record('post_updated', $post, $old, $this->snapshot($post), actor: $actor);

            return $post;
        });
    }

    public function delete(User $actor, Post $post): void
    {
        DB::transaction(function () use ($actor, $post) {
            $old = $this->snapshot($post);
            $post->forceFill(['is_visible' => false])->save();
            $post->delete();
            $this->audit->record('post_deleted', $post, $old, actor: $actor);
        });
    }

    /** Publication planifiée : `scheduled` -> `published` quand l'heure est venue. Renvoie le nombre d'articles publiés. */
    public function publishDue(): int
    {
        $count = 0;
        Post::query()->where('status', 'scheduled')->where('published_at', '<=', now())->orderBy('id')
            ->each(function (Post $post) use (&$count) {
                DB::transaction(function () use ($post, &$count) {
                    $locked = Post::query()->whereKey($post->id)->where('status', 'scheduled')->lockForUpdate()->first();
                    if ($locked === null) {
                        return;
                    }
                    $locked->forceFill(['status' => 'published', 'is_visible' => true])->save();
                    $this->audit->record('post_published_scheduled', $locked, ['status' => 'scheduled'], ['status' => 'published']);
                    $count++;
                });
            });

        return $count;
    }

    /** @param array<string, mixed> $data */
    private function fillContent(Post $post, array $data): void
    {
        $content = array_intersect_key($data, array_flip(['category_id', 'title', 'excerpt', 'body', 'seo_title', 'seo_description']));
        foreach (['title', 'excerpt', 'seo_title', 'seo_description'] as $field) {
            if (array_key_exists($field, $content)) {
                $content[$field] = $content[$field] === null ? null : PlainText::single($content[$field]);
            }
        }

        if (array_key_exists('body', $content)) {
            $clean = $this->sanitizer->clean((string) $content['body']);
            $text = $this->sanitizer->plainText($clean);
            if ($text === '' && ! str_contains($clean, '<img')) {
                throw ValidationException::withMessages(['body' => ['Le contenu de l\'article est vide ou ne contient aucun texte autorisé.']]);
            }
            $content['body'] = $clean;
            $post->reading_minutes = max(1, (int) ceil(count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: []) / 200));
        }

        $post->fill($content);

        if (! $post->exists && ($post->excerpt === null || $post->excerpt === '')) {
            $post->excerpt = Str::limit($this->sanitizer->plainText((string) $post->body), 200, '…');
        }
    }

    /** @param array<string, mixed> $data */
    private function applyFlags(Post $post, array $data): void
    {
        foreach (['is_featured', 'is_flash'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $post->forceFill([$flag => (bool) $data[$flag]]);
            } elseif (! $post->exists) {
                $post->forceFill([$flag => false]);
            }
        }
    }

    /** @param array<string, mixed> $data */
    private function applyPublication(Post $post, array $data): void
    {
        $status = (string) ($data['status'] ?? ($post->exists ? $post->status : 'draft'));
        $publishedAt = array_key_exists('published_at', $data) ? $data['published_at'] : $post->published_at;
        $publishedAt = $publishedAt === null ? null : Carbon::parse($publishedAt);

        if (in_array($status, ['published', 'scheduled'], true)) {
            if ($status === 'scheduled' && $publishedAt === null) {
                throw ValidationException::withMessages(['published_at' => ['La date de publication est obligatoire pour un article planifié.']]);
            }
            $publishedAt ??= now();
            // Une date future ne peut pas être « publiée » maintenant : elle devient planifiée, et inversement.
            $status = $publishedAt->isFuture() ? 'scheduled' : 'published';
        }

        $post->forceFill([
            'status' => $status,
            'published_at' => $publishedAt,
            'is_visible' => $status === 'published',
        ]);
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::limit(Str::slug($title) ?: 'article', 200, '');
        $slug = $base;
        for ($i = 2; Post::withTrashed()->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }

    /** @return array<string, mixed> */
    private function snapshot(Post $post): array
    {
        return [
            'title' => $post->title,
            'category_id' => $post->category_id,
            'status' => $post->status,
            'published_at' => $post->published_at?->toIso8601String(),
            'is_featured' => $post->is_featured,
            'is_flash' => $post->is_flash,
            'is_visible' => $post->is_visible,
        ];
    }
}
