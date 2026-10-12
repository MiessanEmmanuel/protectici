<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

class PurgePendingSubscribers extends RetentionCommand
{
    protected $signature = 'retention:purge-pending-subscribers';

    protected $description = 'Supprime les abonnés à la lettre d\'information jamais confirmés depuis plus de 7 jours';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subDays(7);
        $count = 0;

        do {
            $ids = DB::table('newsletter_subscribers')->where('status', 'pending')->where('created_at', '<', $threshold)->limit(self::BATCH)->pluck('id');
            $count += DB::table('newsletter_subscribers')->whereIn('id', $ids)->where('status', 'pending')->delete();
        } while ($ids->count() === self::BATCH);

        $this->audit($audit, 'retention_purge', $count, $threshold);
        $this->info("{$count} abonné(s) en attente supprimé(s).");

        return self::SUCCESS;
    }
}
