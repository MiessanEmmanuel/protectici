<?php

namespace App\Services\Directory;

use App\Models\District;
use Illuminate\Database\Eloquent\Builder;

/** Briques de filtrage communes (listes, carte). Tous les termes passent par des bindings. */
final class DirectoryFilters
{
    /** Échappe les métacaractères de LIKE (%, _, \). */
    public static function escapeLike(string $term): string
    {
        return addcslashes($term, '\\%_');
    }

    /**
     * Recherche plein texte française (websearch_to_tsquery) + tolérance aux fautes (pg_trgm) + sous-chaîne.
     *
     * @param  Builder<*>  $query
     */
    public static function fullText(Builder $query, string $table, string $term): void
    {
        $like = '%'.self::escapeLike($term).'%';

        $query->where(function ($w) use ($table, $term, $like) {
            $w->whereRaw("{$table}.search_vector @@ websearch_to_tsquery('french', unaccent(?::text))", [$term])
                ->orWhereRaw("word_similarity(unaccent(?::text), unaccent({$table}.name)) >= 0.5", [$term])
                ->orWhereRaw("unaccent({$table}.name) ILIKE unaccent(?::text)", [$like]);
        });
    }

    /** @param Builder<*> $query */
    public static function orderByRelevance(Builder $query, string $table, string $term): void
    {
        $query->orderByRaw("ts_rank({$table}.search_vector, websearch_to_tsquery('french', unaccent(?::text))) DESC", [$term]);
    }

    /**
     * Une commune inclut ses quartiers.
     *
     * @return Builder<District>
     */
    public static function districtIds(string $slug): Builder
    {
        return District::query()
            ->where('slug', $slug)
            ->orWhereIn('parent_id', District::query()->where('slug', $slug)->select('id'))
            ->select('id');
    }
}
