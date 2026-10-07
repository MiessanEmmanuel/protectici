<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Console\Command;

class PurgeUnverifiedUsers extends Command
{
    protected $signature = 'app:purge-unverified-users';

    protected $description = 'Supprime les comptes utilisateur jamais vérifiés depuis plus de 7 jours';

    public function handle(AuditLogger $audit): int
    {
        $cutoff = now()->subDays((int) config('auth.unverified_retention_days', 7));

        $count = User::query()
            ->where('role', User::ROLE_USER)
            ->whereNull('email_verified_at')
            ->where('created_at', '<', $cutoff)
            ->forceDelete();

        $audit->record('unverified_users_purged', context: ['count' => $count]);
        $this->info("{$count} compte(s) non vérifié(s) supprimé(s).");

        return self::SUCCESS;
    }
}
