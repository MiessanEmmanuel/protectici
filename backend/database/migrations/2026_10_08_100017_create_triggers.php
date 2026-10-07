<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // --- Recherche plein texte (unaccent() n'est pas IMMUTABLE : trigger, pas colonne générée) ---
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_providers_search_vector() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.name, ''))), 'A') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.description, ''))), 'B') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.geo_description, ''))), 'C');
                RETURN NEW;
            END;
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_providers_search_vector
            BEFORE INSERT OR UPDATE OF name, description, geo_description ON providers
            FOR EACH ROW EXECUTE FUNCTION fn_providers_search_vector()
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_state_forces_search_vector() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.name, ''))), 'A') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.description, ''))), 'B') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.geo_description, ''))), 'C');
                RETURN NEW;
            END;
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_state_forces_search_vector
            BEFORE INSERT OR UPDATE OF name, description, geo_description ON state_forces
            FOR EACH ROW EXECUTE FUNCTION fn_state_forces_search_vector()
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_posts_search_vector() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.title, ''))), 'A') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.excerpt, ''))), 'B') ||
                    setweight(to_tsvector('french', unaccent(coalesce(NEW.body, ''))), 'C');
                RETURN NEW;
            END;
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_posts_search_vector
            BEFORE INSERT OR UPDATE OF title, excerpt, body ON posts
            FOR EACH ROW EXECUTE FUNCTION fn_posts_search_vector()
        SQL);

        // --- Note moyenne dénormalisée ---
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_refresh_provider_rating(p_provider_id bigint) RETURNS void
            LANGUAGE sql AS $$
                UPDATE providers p
                SET rating_avg = COALESCE(s.avg_rating, 0),
                    rating_count = COALESCE(s.cnt, 0)
                FROM (
                    SELECT round(avg(r.rating)::numeric, 2) AS avg_rating, count(*)::integer AS cnt
                    FROM reviews r
                    WHERE r.provider_id = p_provider_id
                      AND r.status = 'approved' AND r.is_visible AND r.deleted_at IS NULL
                ) s
                WHERE p.id = p_provider_id
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_reviews_refresh_rating() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    PERFORM fn_refresh_provider_rating(OLD.provider_id);
                ELSIF TG_OP = 'INSERT' THEN
                    PERFORM fn_refresh_provider_rating(NEW.provider_id);
                ELSE
                    PERFORM fn_refresh_provider_rating(NEW.provider_id);
                    IF OLD.provider_id IS DISTINCT FROM NEW.provider_id THEN
                        PERFORM fn_refresh_provider_rating(OLD.provider_id);
                    END IF;
                END IF;
                RETURN NULL;
            END;
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_reviews_refresh_rating
            AFTER INSERT OR UPDATE OR DELETE ON reviews
            FOR EACH ROW EXECUTE FUNCTION fn_reviews_refresh_rating()
        SQL);

        // --- Journal d'audit en ajout seul ---
        // Exception unique : ON DELETE SET NULL de audit_logs.user_id (seule colonne modifiée, passage à NULL).
        // Purge (rôle propriétaire) : ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable, puis réactiver.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_audit_logs_immutable() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'UPDATE'
                   AND NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
                   AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
                    RETURN NEW;
                END IF;
                RAISE EXCEPTION 'audit_logs est en ajout seul (% interdit)', TG_OP
                    USING ERRCODE = 'integrity_constraint_violation';
            END;
            $$
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_audit_logs_immutable
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable()
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_audit_logs_no_truncate
            BEFORE TRUNCATE ON audit_logs
            FOR EACH STATEMENT EXECUTE FUNCTION fn_audit_logs_immutable()
        SQL);

        // --- Garde de publication : quitter « approved » retire la visibilité ---
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_publish_guard() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                IF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
                    NEW.is_visible := false;
                END IF;
                RETURN NEW;
            END;
            $$
        SQL);
        foreach (['providers', 'state_forces', 'reviews', 'post_comments'] as $table) {
            DB::unprepared(<<<SQL
                CREATE TRIGGER trg_{$table}_publish_guard
                BEFORE UPDATE ON {$table}
                FOR EACH ROW EXECUTE FUNCTION fn_publish_guard()
            SQL);
        }
    }

    public function down(): void
    {
        foreach (['post_comments', 'reviews', 'state_forces', 'providers'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS trg_{$table}_publish_guard ON {$table}");
        }
        DB::unprepared('DROP FUNCTION IF EXISTS fn_publish_guard()');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_audit_logs_immutable()');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_reviews_refresh_rating ON reviews');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_reviews_refresh_rating()');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_refresh_provider_rating(bigint)');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_posts_search_vector ON posts');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_posts_search_vector()');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_state_forces_search_vector ON state_forces');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_state_forces_search_vector()');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_providers_search_vector ON providers');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_providers_search_vector()');
    }
};
