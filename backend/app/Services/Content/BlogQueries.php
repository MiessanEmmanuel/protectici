<?php

namespace App\Services\Content;

use App\Http\Resources\Content\BlogPresenter;
use App\Models\Post;
use App\Support\IpHasher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;

/** Lectures publiques du blog : seuls les articles publiés, visibles, d'une catégorie visible sont atteignables. */
class BlogQueries
{
    /** @return Builder<Post> */
    public function published(): Builder
    {
        return Post::query()->published()->whereHas('category', fn ($q) => $q->where('is_visible', true));
    }

    /**
     * @param  array<string, mixed>  $filters  category?, q?, featured?, sort?
     * @return Builder<Post>
     */
    public function listing(array $filters): Builder
    {
        $query = $this->published()->with(BlogPresenter::CARD_RELATIONS);

        if (! empty($filters['category'])) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $filters['category']));
        }
        if (! empty($filters['featured'])) {
            $query->where('posts.is_featured', true);
        }

        $term = isset($filters['q']) ? trim((string) $filters['q']) : '';
        if ($term !== '') {
            // websearch_to_tsquery accepte n'importe quelle saisie sans erreur de syntaxe ; recherche insensible aux accents.
            $query->whereRaw("posts.search_vector @@ websearch_to_tsquery('french', unaccent(?))", [$term])
                ->orderByRaw("ts_rank(posts.search_vector, websearch_to_tsquery('french', unaccent(?))) DESC", [$term]);
        }

        if (($filters['sort'] ?? 'recent') === 'popular') {
            $query->orderByDesc('posts.views_count');
        }

        return $query->orderByDesc('posts.published_at')->orderByDesc('posts.id');
    }

    /** @return Collection<int, Post> */
    public function related(Post $post): Collection
    {
        $related = $this->published()->with(BlogPresenter::CARD_RELATIONS)
            ->where('posts.id', '!=', $post->id)->where('posts.category_id', $post->category_id)
            ->orderByDesc('posts.published_at')->limit(3)->get();

        if ($related->count() < 3) {
            $more = $this->published()->with(BlogPresenter::CARD_RELATIONS)
                ->whereNotIn('posts.id', $related->pluck('id')->push($post->id)->all())
                ->orderByDesc('posts.views_count')->limit(3 - $related->count())->get();
            $related = $related->concat($more);
        }

        return new Collection($related->all());
    }

    /** Une vue au plus par fenêtre de 30 minutes et par couple (IP hachée, article). Renvoie vrai si la vue est comptée. */
    public function countView(Post $post, ?string $ip): bool
    {
        $key = 'blog-view:'.$post->id.':'.substr((string) IpHasher::hash($ip ?? 'inconnue'), 0, 32);
        if (! Cache::add($key, 1, now()->addMinutes(30))) {
            return false;
        }
        Post::query()->whereKey($post->id)->increment('views_count');
        $post->views_count++;

        return true;
    }

    /** @return Collection<int, Post> */
    public function flash(): Collection
    {
        return $this->published()->where('posts.is_flash', true)
            ->orderByDesc('posts.published_at')->limit(10)->get(['posts.id', 'posts.slug', 'posts.title', 'posts.published_at']);
    }
}
