<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

class PurgeContactMessages extends RetentionCommand
{
    protected $signature = 'retention:purge-contact-messages';

    protected $description = 'Supprime physiquement les messages de contact de plus de 12 mois';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subMonthsNoOverflow(12);
        $count = 0;

        do {
            $ids = DB::table('contact_messages')->where('created_at', '<', $threshold)->limit(self::BATCH)->pluck('id');
            $count += DB::table('contact_messages')->whereIn('id', $ids)->delete();
        } while ($ids->count() === self::BATCH);

        $this->audit($audit, 'retention_purge', $count, $threshold);
        $this->info("{$count} message(s) de contact supprimé(s).");

        return self::SUCCESS;
    }
}
