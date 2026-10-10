<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class AnonymizeFeedbacks extends RetentionCommand
{
    protected $signature = 'retention:anonymize-feedbacks';

    protected $description = 'Anonymise les « Dis-moi tout » clos depuis plus de 36 mois (y compris supprimés logiquement)';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subMonthsNoOverflow(36);
        $count = 0;

        do {
            $ids = DB::table('feedbacks')
                ->whereNotNull('resolved_at')->where('resolved_at', '<', $threshold)
                ->where(fn (Builder $q) => $q->whereNotNull('email')->orWhereNotNull('phone')->orWhereNotNull('civility')
                    ->orWhereNotNull('user_id')->orWhereNotNull('ip_hash')
                    ->orWhere('first_name', '<>', 'Anonymisé')->orWhere('last_name', '<>', 'Anonymisé'))
                ->limit(self::BATCH)->pluck('id');

            $count += DB::table('feedbacks')->whereIn('id', $ids)->update([
                'first_name' => 'Anonymisé', 'last_name' => 'Anonymisé', 'email' => null, 'phone' => null,
                'civility' => null, 'user_id' => null, 'ip_hash' => null,
            ]);
        } while ($ids->count() === self::BATCH);

        $this->audit($audit, 'retention_anonymize', $count, $threshold);
        $this->info("{$count} « Dis-moi tout » anonymisé(s).");

        return self::SUCCESS;
    }
}
