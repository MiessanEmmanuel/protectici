<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

class PurgeIdempotencyKeys extends RetentionCommand
{
    protected $signature = 'retention:purge-idempotency-keys';

    protected $description = 'Supprime les clés d\'idempotence créées il y a plus de 48 heures';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subHours(48);
        $count = 0;

        do {
            $ids = DB::table('idempotency_keys')->where('created_at', '<', $threshold)->limit(self::BATCH)->pluck('id');
            $count += DB::table('idempotency_keys')->whereIn('id', $ids)->delete();
        } while ($ids->count() === self::BATCH);

        $this->audit($audit, 'retention_purge', $count, $threshold);
        $this->info("{$count} clé(s) d'idempotence supprimée(s).");

        return self::SUCCESS;
    }
}
