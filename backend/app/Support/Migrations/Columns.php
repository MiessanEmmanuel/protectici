<?php

namespace App\Support\Migrations;

use Illuminate\Database\Schema\Blueprint;

/**
 * Colonnes communes des migrations (modele.md §2.0) : timestamptz NN DEFAULT now().
 */
final class Columns
{
    public static function tracking(Blueprint $table, bool $softDeletes = false): void
    {
        $table->timestampTz('created_at')->useCurrent();
        $table->timestampTz('updated_at')->useCurrent();

        if ($softDeletes) {
            $table->timestampTz('deleted_at')->nullable();
        }
    }

    public static function visible(Blueprint $table): void
    {
        $table->boolean('is_visible')->default(false);
    }

    public static function coordinates(Blueprint $table): void
    {
        $table->decimal('latitude', 9, 6)->nullable();
        $table->decimal('longitude', 9, 6)->nullable();
    }
}
