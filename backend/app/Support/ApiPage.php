<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/** Enveloppe de liste paginée du contrat (§1) : { data, meta, links }. */
final class ApiPage
{
    /**
     * @param  LengthAwarePaginator<int, mixed>  $page
     * @param  array<int, mixed>  $rows  lignes déjà sérialisées
     */
    public static function response(LengthAwarePaginator $page, array $rows): JsonResponse
    {
        return response()->json([
            'data' => array_values($rows),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
        ]);
    }

    /** Date ISO 8601 UTC du contrat. */
    public static function iso(?\DateTimeInterface $date): ?string
    {
        return $date === null ? null : Carbon::instance($date)->utc()->format('Y-m-d\TH:i:s\Z');
    }

    /** Taille de page bornée (défaut 12, max 50). */
    public static function perPage(mixed $value): int
    {
        return max(1, min(50, is_numeric($value) ? (int) $value : 12));
    }

    /** Échappe un terme pour un LIKE (pas de joker injecté par l'utilisateur). */
    public static function like(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }
}
