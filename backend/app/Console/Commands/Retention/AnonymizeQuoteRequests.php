<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class AnonymizeQuoteRequests extends RetentionCommand
{
    protected $signature = 'retention:anonymize-quote-requests';

    protected $description = 'Anonymise les demandes de devis de plus de 24 mois (y compris supprimées logiquement)';

    public function handle(AuditLogger $audit): int
    {
        $threshold = now()->subMonthsNoOverflow(24);
        $count = 0;

        do {
            $ids = DB::table('quote_requests')
                ->where('created_at', '<', $threshold)
                ->where(fn (Builder $q) => $q->whereNotNull('email')->orWhereNotNull('company_name')
                    ->orWhereNotNull('user_id')->orWhereNotNull('ip_hash')
                    ->orWhere('first_name', '<>', 'Anonymisé')->orWhere('last_name', '<>', 'Anonymisé')
                    ->orWhere('phone', '<>', 'anonymisé')->orWhere('description', '<>', '[Contenu anonymisé]'))
                ->limit(self::BATCH)->pluck('id');

            if ($ids->isNotEmpty()) {
                DB::transaction(function () use ($ids, &$count): void {
                    $count += DB::table('quote_requests')->whereIn('id', $ids)->update([
                        'first_name' => 'Anonymisé', 'last_name' => 'Anonymisé', 'email' => null, 'phone' => 'anonymisé',
                        'company_name' => null, 'user_id' => null, 'ip_hash' => null, 'description' => '[Contenu anonymisé]',
                    ]);
                    DB::table('quote_request_recipients')->whereIn('quote_request_id', $ids)->update(['response_message' => null]);
                });
            }
        } while ($ids->count() === self::BATCH);

        $this->audit($audit, 'retention_anonymize', $count, $threshold);
        $this->info("{$count} demande(s) de devis anonymisée(s).");

        return self::SUCCESS;
    }
}
