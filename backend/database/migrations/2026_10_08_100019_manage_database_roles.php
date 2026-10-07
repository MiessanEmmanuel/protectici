<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rôles PostgreSQL et GRANT (modele.md §6.1).
 *
 * Désactivé par défaut : les rôles sont globaux au cluster et exigent CREATEROLE.
 * Activer avec DB_MANAGE_ROLES=true (staging/production, exécuté avec protectici_owner/superuser).
 * Les rôles sont créés NOLOGIN et sans mot de passe : l'exploitant leur attribue LOGIN + mot de passe fort hors dépôt.
 */
return new class extends Migration
{
    private function enabled(): bool
    {
        return (bool) config('database.manage_roles');
    }

    public function up(): void
    {
        if (! $this->enabled()) {
            return;
        }

        foreach (['protectici_owner', 'protectici_app', 'protectici_ro'] as $role) {
            DB::unprepared(<<<SQL
                DO \$\$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{$role}') THEN
                        CREATE ROLE {$role} NOLOGIN;
                    END IF;
                END \$\$
            SQL);
        }

        DB::unprepared('GRANT USAGE ON SCHEMA public TO protectici_app, protectici_ro');
        DB::unprepared('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO protectici_app');
        DB::unprepared('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO protectici_app');
        DB::unprepared('REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM protectici_app');
        // Lecture seule hors colonnes sensibles de users.
        DB::unprepared('GRANT SELECT ON ALL TABLES IN SCHEMA public TO protectici_ro');
        DB::unprepared('REVOKE SELECT ON users FROM protectici_ro');
        DB::unprepared('GRANT SELECT (id, first_name, last_name, role, is_active, email_verified_at, last_login_at, created_at, updated_at, deleted_at) ON users TO protectici_ro');
        DB::unprepared('REVOKE ALL ON password_reset_tokens, sessions FROM protectici_ro');
    }

    public function down(): void
    {
        if (! $this->enabled()) {
            return;
        }

        DB::unprepared('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM protectici_app, protectici_ro');
        DB::unprepared('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM protectici_app');
        // Les rôles (objets globaux du cluster) ne sont volontairement pas supprimés.
    }
};
