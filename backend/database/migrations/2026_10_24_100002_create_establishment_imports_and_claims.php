<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Import Excel des fiches (plan_import_etablissements.md §6.1) et revendication d'une fiche sans propriétaire (§5.2).
 * - establishment_imports : un lot d'import (fichier privé, état, compteurs, rapport par ligne sans donnée sensible).
 * - providers.import_id / state_forces.import_id : lot d'origine d'une fiche (filtre admin, annulation d'un import).
 * - establishment_claims : demande de rattachement d'une fiche à un compte, cible provider XOR state_force,
 *   une seule demande en attente par fiche et par utilisateur, justificatif unique sur le disque privé.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('establishment_imports', function (Blueprint $t) {
            $t->id();
            $t->string('type', 20);
            $t->string('status', 20)->default('uploaded');
            $t->string('publish_mode', 20)->default('publish');
            $t->string('file_disk', 20)->default('private');
            $t->string('file_path', 500)->nullable(); // null une fois le fichier purgé (rétention 30 jours)
            $t->string('original_name', 255);
            $t->unsignedInteger('rows_total')->default(0);
            $t->unsignedInteger('rows_valid')->default(0);
            $t->unsignedInteger('rows_invalid')->default(0);
            $t->unsignedInteger('rows_duplicate')->default(0);
            $t->unsignedInteger('rows_created')->default(0);
            $t->jsonb('report')->nullable();
            $t->text('failure_message')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestampTz('confirmed_at')->nullable();
            $t->timestampTz('finished_at')->nullable();
            $t->timestampTz('cancelled_at')->nullable();
            $t->timestampsTz();
            $t->index(['type', 'created_at']);
        });
        DB::statement("ALTER TABLE establishment_imports ADD CONSTRAINT establishment_imports_type_chk CHECK (type IN ('provider','state_force'))");
        DB::statement("ALTER TABLE establishment_imports ADD CONSTRAINT establishment_imports_status_chk CHECK (status IN ('uploaded','analyzing','ready','importing','done','failed','cancelled'))");
        DB::statement("ALTER TABLE establishment_imports ADD CONSTRAINT establishment_imports_publish_mode_chk CHECK (publish_mode IN ('publish','pending'))");

        foreach (['providers', 'state_forces'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->foreignId('import_id')->nullable()->index()->constrained('establishment_imports')->nullOnDelete();
            });
        }

        Schema::create('establishment_claims', function (Blueprint $t) {
            $t->id();
            $t->foreignId('provider_id')->nullable()->index()->constrained('providers')->cascadeOnDelete();
            $t->foreignId('state_force_id')->nullable()->index()->constrained('state_forces')->cascadeOnDelete();
            $t->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $t->string('submitter_role', 20);
            $t->string('phone', 30);
            $t->text('message')->nullable();
            $t->string('document_disk', 20)->default('private');
            $t->string('document_path', 500)->nullable();
            $t->string('document_original_name', 255)->nullable();
            $t->string('document_mime_type', 100)->nullable();
            $t->unsignedInteger('document_size_bytes')->nullable();
            $t->string('status', 20)->default('pending');
            $t->text('rejection_reason')->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestampTz('reviewed_at')->nullable();
            $t->timestampsTz();
            $t->index(['status', 'created_at']);
        });
        DB::statement('ALTER TABLE establishment_claims ADD CONSTRAINT establishment_claims_one_target_chk CHECK ((provider_id IS NULL) <> (state_force_id IS NULL))');
        DB::statement("ALTER TABLE establishment_claims ADD CONSTRAINT establishment_claims_status_chk CHECK (status IN ('pending','approved','rejected'))");
        DB::statement("ALTER TABLE establishment_claims ADD CONSTRAINT establishment_claims_submitter_role_chk CHECK (submitter_role IN ('manager','employee','other'))");
        DB::statement("ALTER TABLE establishment_claims ADD CONSTRAINT establishment_claims_rejection_reason_chk CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)");
        DB::statement("ALTER TABLE establishment_claims ADD CONSTRAINT establishment_claims_document_mime_chk CHECK (document_mime_type IS NULL OR document_mime_type IN ('application/pdf','image/jpeg','image/png'))");
        DB::statement("CREATE UNIQUE INDEX establishment_claims_one_pending_provider_uq ON establishment_claims (provider_id, user_id) WHERE status = 'pending' AND provider_id IS NOT NULL");
        DB::statement("CREATE UNIQUE INDEX establishment_claims_one_pending_state_force_uq ON establishment_claims (state_force_id, user_id) WHERE status = 'pending' AND state_force_id IS NOT NULL");
    }

    public function down(): void
    {
        Schema::dropIfExists('establishment_claims');
        foreach (['providers', 'state_forces'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('import_id');
            });
        }
        Schema::dropIfExists('establishment_imports');
    }
};
