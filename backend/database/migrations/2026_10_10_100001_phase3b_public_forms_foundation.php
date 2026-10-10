<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 vague B : les formulaires publics (feedbacks, devis, contact) sont ouverts aux visiteurs. Les clés
 * d'idempotence peuvent donc ne pas avoir d'utilisateur : unicité (scope, key) pour les envois anonymes.
 * (Les finalités de consentement feedback / quote / contact existent déjà dans consent_logs_purpose_chk.)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE idempotency_keys ALTER COLUMN user_id DROP NOT NULL');
        DB::statement('CREATE UNIQUE INDEX idempotency_keys_anonymous_scope_key_uq ON idempotency_keys (scope, key) WHERE user_id IS NULL');
        // Rétention / anonymisation : retrouver rapidement les dossiers clos et les plus anciens.
        DB::statement('CREATE INDEX feedbacks_resolved_at_idx ON feedbacks (resolved_at) WHERE resolved_at IS NOT NULL');
        DB::statement('CREATE INDEX contact_messages_created_at_idx ON contact_messages (created_at)');
        DB::statement('CREATE INDEX quote_requests_created_at_idx ON quote_requests (created_at)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS quote_requests_created_at_idx');
        DB::statement('DROP INDEX IF EXISTS contact_messages_created_at_idx');
        DB::statement('DROP INDEX IF EXISTS feedbacks_resolved_at_idx');
        DB::statement('DROP INDEX IF EXISTS idempotency_keys_anonymous_scope_key_uq');
        DB::statement('DELETE FROM idempotency_keys WHERE user_id IS NULL');
        DB::statement('ALTER TABLE idempotency_keys ALTER COLUMN user_id SET NOT NULL');
    }
};
