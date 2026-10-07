<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['postgis', 'citext', 'unaccent', 'pg_trgm'] as $extension) {
            DB::statement("CREATE EXTENSION IF NOT EXISTS {$extension}");
        }
    }

    public function down(): void
    {
        // Les extensions sont partagées par la base : on ne les supprime pas
        // (DROP EXTENSION postgis détruirait toute donnée géographique).
    }
};
