<?php

namespace App\Http\Resources\Content;

use App\Models\Media;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Support\ApiPage;

/**
 * Sérialisation du contenu éditorial (contrat §9). Les listes doivent précharger `category`, `author` et `cover`
 * (le chargement paresseux est interdit hors production). Jamais d'e-mail ni d'identifiant interne d'auteur.
 */
final class BlogPresenter
{
    /** Relations à précharger pour une carte d'article. */
    public const CARD_RELATIONS = ['category:id,slug,name', 'author:id,first_name,last_name', 'cover'];

    /** @return array<string, mixed> */
    public static function card(Post $post): array
    {
        return [
            'slug' => $post->slug,
            'title' => $post->title,
            'excerpt' => (string) $post->excerpt,
            'category' => ['slug' => $post->category->slug, 'name' => $post->category->name],
            'cover_url' => $post->cover?->url(),
            'cover_alt' => $post->cover?->alt_text,
            'published_at' => ApiPage::iso($post->published_at),
            'reading_minutes' => $post->reading_minutes,
            'views_count' => $post->views_count,
            'is_featured' => $post->is_featured,
            'author_name' => self::authorName($post->author),
        ];
    }

    /**
     * @param  iterable<Post>  $related
     * @return array<string, mixed>
     */
    public static function detail(Post $post, iterable $related): array
    {
        $cards = [];
        foreach ($related as $item) {
            $cards[] = self::card($item);
        }

        return self::card($post) + [
            'body' => $post->body,
            'seo_title' => $post->seo_title,
            'seo_description' => $post->seo_description,
            'related' => $cards,
        ];
    }

    /** @return array<string, mixed> */
    public static function adminPost(Post $post, bool $withBody): array
    {
        $row = [
            'id' => $post->id,
            'slug' => $post->slug,
            'title' => $post->title,
            'excerpt' => $post->excerpt,
            'status' => $post->status,
            'published_at' => ApiPage::iso($post->published_at),
            'is_featured' => $post->is_featured,
            'is_flash' => $post->is_flash,
            'views_count' => $post->views_count,
            'reading_minutes' => $post->reading_minutes,
            'seo_title' => $post->seo_title,
            'seo_description' => $post->seo_description,
            'category' => ['id' => $post->category->id, 'slug' => $post->category->slug, 'name' => $post->category->name],
            'cover' => self::media($post->cover),
            'author_name' => self::authorName($post->author),
            'created_at' => ApiPage::iso($post->created_at),
            'updated_at' => ApiPage::iso($post->updated_at),
        ];
        if ($withBody) {
            $row['body'] = $post->body;
        }

        return $row;
    }

    /** @return array<string, mixed>|null */
    public static function media(?Media $media): ?array
    {
        return $media === null ? null : ['id' => $media->id, 'url' => $media->url(), 'alt' => $media->alt_text];
    }

    /** @return array<string, mixed> */
    public static function comment(PostComment $comment, bool $withReplies): array
    {
        $row = [
            'id' => $comment->id,
            'body' => $comment->body,
            'author_name' => self::authorName($comment->user) ?? 'Utilisateur',
            'created_at' => ApiPage::iso($comment->created_at),
        ];
        if ($withReplies) {
            $row['replies'] = $comment->replies->map(fn (PostComment $reply) => self::comment($reply, false))->values()->all();
        }

        return $row;
    }

    /** @return array<string, mixed> */
    public static function partner(Partner $partner): array
    {
        return [
            'id' => $partner->id,
            'type' => $partner->type,
            'name' => $partner->name,
            'website_url' => $partner->website_url,
            'description' => $partner->description,
            'logo_url' => $partner->logo?->url(),
        ];
    }

    /** « Prénom N. » : jamais le nom complet ni l'e-mail. */
    public static function authorName(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }
        $last = mb_substr(trim($user->last_name), 0, 1);

        return trim($user->first_name.($last !== '' ? ' '.mb_strtoupper($last).'.' : ''));
    }
}
