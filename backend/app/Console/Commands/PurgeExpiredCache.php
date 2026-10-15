<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Le magasin de cache « database » ne supprime une entrée expirée que lorsqu'on la relit : les clés du cache de
 * réponses publiques (une par combinaison de paramètres) s'accumuleraient. Purge horaire des lignes expirées.
 */
class PurgeExpiredCache extends Command
{
    protected $signature = 'cache:purge-expired';

    protected $description = 'Supprime les entrées expirées du cache en base (cache, verrous)';

    public function handle(): int
    {
        $tables = [
            (string) (config('cache.stores.database.table') ?: 'cache'),
            (string) (config('cache.stores.database.lock_table') ?: 'cache_locks'),
        ];

        $deleted = 0;
        foreach ($tables as $table) {
            $deleted += DB::table($table)->where('expiration', '<=', time())->delete();
        }

        $this->info("{$deleted} entrée(s) de cache expirée(s) supprimée(s).");

        return self::SUCCESS;
    }
}
