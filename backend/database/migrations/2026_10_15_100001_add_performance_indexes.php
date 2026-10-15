<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 5 (performance) : index partiels alignés sur les tris des listes publiques (modele.md §4).
 * Additive et réversible. Les prédicats reprennent exactement ceux des listes publiques
 * (visible + approuvé + non supprimé) pour que le planificateur puisse les utiliser.
 * Sur une base déjà volumineuse en production, créer ces index avec CREATE INDEX CONCURRENTLY hors migration.
 */
return new class extends Migration
{
    private const PUBLIC = "is_visible AND status = 'approved' AND deleted_at IS NULL";

    /** @return array<string, string> nom d'index => instruction CREATE */
    private function indexes(): array
    {
        $pub = self::PUBLIC;

        return [
            // Tri par défaut de l'annuaire (nom) : évite le tri complet + OFFSET profond coûteux.
            'providers_public_name_idx' => "CREATE INDEX IF NOT EXISTS providers_public_name_idx ON providers (name, id) WHERE {$pub}",
            // Tri « populaires » (accueil, section populaires, sort=-popular).
            'providers_public_popular_idx' => "CREATE INDEX IF NOT EXISTS providers_public_popular_idx ON providers (is_featured DESC, rating_avg DESC, rating_count DESC, views_count DESC, id) WHERE {$pub}",
            // Tri par note (sort=-rating).
            'providers_public_rating_idx' => "CREATE INDEX IF NOT EXISTS providers_public_rating_idx ON providers (rating_avg DESC, rating_count DESC, name, id) WHERE {$pub}",
            // Tri par défaut des forces étatiques.
            'state_forces_public_name_idx' => "CREATE INDEX IF NOT EXISTS state_forces_public_name_idx ON state_forces (name, id) WHERE {$pub}",
        ];
    }

    public function up(): void
    {
        foreach ($this->indexes() as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach (array_keys($this->indexes()) as $name) {
            DB::statement("DROP INDEX IF EXISTS {$name}");
        }
    }
};
