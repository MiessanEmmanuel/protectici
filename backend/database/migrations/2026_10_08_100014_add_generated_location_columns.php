<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var list<string> */
    private array $tables = ['cities', 'districts', 'providers', 'state_forces'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            DB::statement(<<<SQL
                ALTER TABLE {$table} ADD COLUMN location geography(Point, 4326)
                GENERATED ALWAYS AS (
                    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                        THEN ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
                    END
                ) STORED
            SQL);
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $table) {
            DB::statement("ALTER TABLE {$table} DROP COLUMN IF EXISTS location");
        }
    }
};
