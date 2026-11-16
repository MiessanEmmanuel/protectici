<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Finalité de consentement `claim` (revendication d'une fiche, docs/api-contract.md §10.3).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_purpose_chk');
        DB::statement("ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_purpose_chk CHECK (purpose IN ('privacy_policy','registration','establishment','newsletter','feedback','quote','contact','claim'))");
    }

    public function down(): void
    {
        DB::statement("DELETE FROM consent_logs WHERE purpose = 'claim'");
        DB::statement('ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_purpose_chk');
        DB::statement("ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_purpose_chk CHECK (purpose IN ('privacy_policy','registration','establishment','newsletter','feedback','quote','contact'))");
    }
};
