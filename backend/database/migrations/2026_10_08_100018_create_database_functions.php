<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_providers_nearby(
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

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_state_forces_nearby(
                lat double precision,
                lng double precision,
                radius_m integer,
                lim integer,
                force_type_id bigint DEFAULT NULL,
                procedure_type_id bigint DEFAULT NULL
            )
            RETURNS TABLE (id bigint, distance_m double precision)
            LANGUAGE sql STABLE AS $$
                SELECT s.id, ST_Distance(s.location, c.pt) AS distance_m
                FROM state_forces s
                CROSS JOIN (SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS pt) c
                WHERE s.is_visible AND s.status = 'approved' AND s.deleted_at IS NULL
                  AND s.location IS NOT NULL
                  AND ST_DWithin(s.location, c.pt, radius_m)
                  AND (fn_state_forces_nearby.force_type_id IS NULL OR s.force_type_id = fn_state_forces_nearby.force_type_id)
                  AND (fn_state_forces_nearby.procedure_type_id IS NULL OR EXISTS (
                        SELECT 1 FROM state_force_procedure_type sp
                        WHERE sp.state_force_id = s.id
                          AND sp.procedure_type_id = fn_state_forces_nearby.procedure_type_id))
                ORDER BY s.location <-> c.pt
                LIMIT lim
            $$
        SQL);

        // Anonymisation d'un compte (modele.md §5.3). Le journal est écrit dans audit_logs.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE PROCEDURE sp_anonymize_user(p_user_id bigint)
            LANGUAGE plpgsql AS $$
            DECLARE
                v_email text;
            BEGIN
                SELECT email::text INTO v_email FROM users WHERE id = p_user_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Utilisateur % introuvable', p_user_id;
                END IF;

                UPDATE users SET
                    first_name = 'Utilisateur',
                    last_name = 'Anonymisé',
                    email = 'anonymise-' || id || '@anonymise.invalid',
                    phone = NULL,
                    password = '!anonymise!',
                    role = 'user',
                    is_active = false,
                    email_verified_at = NULL,
                    two_factor_secret = NULL,
                    two_factor_recovery_codes = NULL,
                    two_factor_confirmed_at = NULL,
                    remember_token = NULL,
                    deleted_at = COALESCE(deleted_at, now()),
                    updated_at = now()
                WHERE id = p_user_id;

                UPDATE reviews SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE post_comments SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE feedbacks SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE quote_requests SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE providers SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE state_forces SET user_id = NULL, updated_at = now() WHERE user_id = p_user_id;
                UPDATE consent_logs SET user_id = NULL WHERE user_id = p_user_id;

                DELETE FROM sessions WHERE user_id = p_user_id;
                DELETE FROM favorites WHERE user_id = p_user_id;
                DELETE FROM newsletter_subscribers WHERE email = v_email::citext;
                DELETE FROM password_reset_tokens WHERE email = v_email::citext;

                INSERT INTO audit_logs (user_id, event, auditable_type, auditable_id, context)
                VALUES (NULL, 'user_anonymized', 'user', p_user_id, jsonb_build_object('source', 'sp_anonymize_user'));
            END;
            $$
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP PROCEDURE IF EXISTS sp_anonymize_user(bigint)');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_state_forces_nearby(double precision, double precision, integer, integer, bigint, bigint)');
        DB::unprepared('DROP FUNCTION IF EXISTS fn_providers_nearby(double precision, double precision, integer, integer)');
    }
};
