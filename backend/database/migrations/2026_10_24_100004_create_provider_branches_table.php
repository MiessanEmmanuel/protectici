<?php

use App\Support\Migrations\Columns;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Agences (adresses secondaires) des prestataires (modele.md §2.4 bis). L'adresse de la fiche reste le siège.
 * location : colonne générée à partir de latitude/longitude, comme providers (migration 2026_10_08_100014).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('provider_branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->index()->constrained('providers')->cascadeOnDelete();
            $table->string('label', 150);
            $table->foreignId('city_id')->index()->constrained('cities')->restrictOnDelete();
            $table->foreignId('district_id')->nullable()->index()->constrained('districts')->nullOnDelete();
            $table->string('address', 255)->nullable();
            $table->text('geo_description')->nullable();
            $table->string('phone', 30)->nullable();
            Columns::coordinates($table);
            $table->smallInteger('sort_order')->default(0);
            Columns::tracking($table);
        });

        DB::statement(<<<'SQL'
            ALTER TABLE provider_branches ADD COLUMN location geography(Point, 4326)
            GENERATED ALWAYS AS (
                CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
                END
            ) STORED
        SQL);

        DB::statement('ALTER TABLE provider_branches ADD CONSTRAINT provider_branches_lat_range_chk CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE provider_branches ADD CONSTRAINT provider_branches_lng_range_chk CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)');
        DB::statement('ALTER TABLE provider_branches ADD CONSTRAINT provider_branches_lat_lng_pair_chk CHECK ((latitude IS NULL) = (longitude IS NULL))');
        DB::statement('CREATE INDEX provider_branches_location_gist ON provider_branches USING gist (location)');
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_branches');
    }
};
