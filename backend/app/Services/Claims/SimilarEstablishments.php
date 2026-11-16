<?php

namespace App\Services\Claims;

use App\Enums\EstablishmentType;
use App\Models\Provider;
use App\Models\StateForce;
use App\Support\ApiPage;

/**
 * Anti-doublon à l'inscription (contrat §10.3) : jusqu'à 5 fiches PUBLIÉES dont le nom est proche (pg_trgm +
 * unaccent, ou inclusion), dans la ville indiquée le cas échéant, ou portant le même téléphone normalisé.
 * Ne renvoie que des données publiques (SimilarEstablishment) ; toutes les valeurs sont liées (aucune concaténation).
 */
class SimilarEstablishments
{
    private const LIMIT = 5;

    private const MIN_SIMILARITY = 0.3;

    /**
     * @param  array{type: string, name: string, city_id?: int|null, phone?: string|null}  $criteria  données validées
     * @return list<array{type: string, slug: string, name: string, city: array{name: string}|null, is_claimable: bool}>
     */
    public function find(array $criteria): array
    {
        $kind = EstablishmentType::from($criteria['type']);
        $table = $kind->table();
        $name = mb_strtolower($criteria['name']);
        $cityId = isset($criteria['city_id']) ? (int) $criteria['city_id'] : null;
        $phone = $criteria['phone'] ?? null;

        $nameSql = "(similarity(unaccent(lower({$table}.name)), unaccent(?)) >= ? OR unaccent(lower({$table}.name)) LIKE unaccent(?))";
        $nameBindings = [$name, self::MIN_SIMILARITY, ApiPage::like($name)];

        $rows = $kind->query()
            ->published()
            ->with('city')
            ->where(function ($q) use ($table, $nameSql, $nameBindings, $cityId, $phone) {
                $q->where(function ($q) use ($table, $nameSql, $nameBindings, $cityId) {
                    $q->whereRaw($nameSql, $nameBindings);
                    if ($cityId !== null) {
                        $q->where("{$table}.city_id", $cityId);
                    }
                });
                if ($phone !== null && $phone !== '') {
                    $q->orWhere("{$table}.phone", $phone)->orWhere("{$table}.phone_alt", $phone);
                }
            })
            ->orderByRaw("similarity(unaccent(lower({$table}.name)), unaccent(?)) DESC", [$name])
            ->orderBy("{$table}.id")
            ->limit(self::LIMIT)
            ->get();

        return $rows->map(fn (Provider|StateForce $e) => [
            'type' => $kind->value,
            'slug' => $e->slug,
            'name' => $e->name,
            'city' => $e->city === null ? null : ['name' => $e->city->name],
            'is_claimable' => $e->user_id === null,
        ])->values()->all();
    }
}
