<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3 vague A : le workflow (justificatifs, demandes de modification) s'applique aux prestataires ET aux
 * forces étatiques (contrat §7.2). Les tables existantes deviennent « bi-cibles » (provider_id XOR state_force_id)
 * pour conserver un seul espace d'identifiants. Ajoute aussi les clés d'idempotence des formulaires et la finalité
 * de consentement « establishment ».
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['provider_documents', 'provider_change_requests'] as $table) {
            DB::statement("ALTER TABLE {$table} ALTER COLUMN provider_id DROP NOT NULL");
            Schema::table($table, function (Blueprint $t) {
                $t->foreignId('state_force_id')->nullable()->index()->constrained('state_forces')->cascadeOnDelete();
            });
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_one_target_chk CHECK ((provider_id IS NULL) <> (state_force_id IS NULL))");
        }

        // Une seule demande de modification en attente à la fois par fiche (garanti par la base, sans course possible).
        DB::statement("CREATE UNIQUE INDEX provider_change_requests_one_pending_provider_uq ON provider_change_requests (provider_id) WHERE status = 'pending' AND provider_id IS NOT NULL");
        DB::statement("CREATE UNIQUE INDEX provider_change_requests_one_pending_state_force_uq ON provider_change_requests (state_force_id) WHERE status = 'pending' AND state_force_id IS NOT NULL");

        Schema::create('idempotency_keys', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('scope', 40);
            $t->string('key', 64);
            $t->char('request_hash', 64);
            $t->string('resource_type', 50)->nullable();
            $t->unsignedBigInteger('resource_id')->nullable();
            $t->timestampTz('created_at')->useCurrent();
            $t->unique(['user_id', 'scope', 'key'], 'idempotency_keys_user_scope_key_uq');
            $t->index('created_at');
        });

        DB::statement('ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_purpose_chk');
        DB::statement("ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_purpose_chk CHECK (purpose IN ('privacy_policy','registration','establishment','newsletter','feedback','quote','contact'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_purpose_chk');
        DB::statement("ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_purpose_chk CHECK (purpose IN ('privacy_policy','registration','newsletter','feedback','quote','contact'))");

        Schema::dropIfExists('idempotency_keys');
        DB::statement('DROP INDEX IF EXISTS provider_change_requests_one_pending_state_force_uq');
        DB::statement('DROP INDEX IF EXISTS provider_change_requests_one_pending_provider_uq');

        foreach (['provider_change_requests', 'provider_documents'] as $table) {
            DB::statement("DELETE FROM {$table} WHERE state_force_id IS NOT NULL");
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$table}_one_target_chk");
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('state_force_id');
            });
            DB::statement("ALTER TABLE {$table} ALTER COLUMN provider_id SET NOT NULL");
        }
    }
};
