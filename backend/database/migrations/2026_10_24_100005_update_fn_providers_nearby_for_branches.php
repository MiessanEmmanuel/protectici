<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * fn_providers_nearby tient compte des agences (modele.md §5.2) : la distance d'un prestataire est la distance
 * minimale entre le point recherché et {siège, agences}. Nouvelle colonne branch_id : agence la plus proche,
 * null si c'est le siège (à égalité, le siège l'emporte). Le type de retour change : DROP puis CREATE.
 */
return new class extends Migration
{
    private const SIGNATURE = 'fn_providers_nearby(double precision, double precision, integer, integer)';

    public function up(): void
    {
        DB::unprepared('DROP FUNCTION IF EXISTS '.self::SIGNATURE);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION fn_providers_nearby(
                lat double precision,
                lng double precision,
                radius_m integer,
                lim integer
            )
            RETURNS TABLE (id bigint, distance_m double precision, branch_id bigint)
            LANGUAGE sql STABLE AS $$
                WITH c AS (SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS pt),
                pts AS (
                    SELECT p.id AS provider_id, NULL::bigint AS branch_id, ST_Distance(p.location, c.pt) AS distance_m
                    FROM providers p CROSS JOIN c
                    WHERE p.is_visible AND p.status = 'approved' AND p.deleted_at IS NULL
                      AND p.location IS NOT NULL
                      AND ST_DWithin(p.location, c.pt, radius_m)
                    UNION ALL
                    SELECT b.provider_id, b.id, ST_Distance(b.location, c.pt)
                    FROM provider_branches b
                    JOIN providers p ON p.id = b.provider_id
                    CROSS JOIN c
                    WHERE p.is_visible AND p.status = 'approved' AND p.deleted_at IS NULL
                      AND b.location IS NOT NULL
                      AND ST_DWithin(b.location, c.pt, radius_m)
                ),
                best AS (
                    SELECT DISTINCT ON (pts.provider_id) pts.provider_id, pts.distance_m, pts.branch_id
                    FROM pts
                    ORDER BY pts.provider_id, pts.distance_m, pts.branch_id NULLS FIRST
                )
                SELECT best.provider_id, best.distance_m, best.branch_id
                FROM best
                ORDER BY best.distance_m, best.provider_id
                LIMIT lim
            $$
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP FUNCTION IF EXISTS '.self::SIGNATURE);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION fn_providers_nearby(
                lat double precision,
                lng double precision,
                radius_m integer,
                lim integer
            )
            RETURNS TABLE (id bigint, distance_m double precision)
            LANGUAGE sql STABLE AS $$
                SELECT p.id, ST_Distance(p.location, c.pt) AS distance_m
                FROM providers p
                CROSS JOIN (SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS pt) c
                WHERE p.is_visible AND p.status = 'approved' AND p.deleted_at IS NULL
                  AND p.location IS NOT NULL
                  AND ST_DWithin(p.location, c.pt, radius_m)
                ORDER BY p.location <-> c.pt
                LIMIT lim
            $$
        SQL);
    }
};
