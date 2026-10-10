<?php

namespace App\Console\Commands\Retention;

use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Base des commandes de rétention (modele.md §5.3, api-contract §8.6). Chaque exécution qui a touché au moins une
 * ligne écrit UN enregistrement d'audit {command, count, threshold_date} : jamais de donnée personnelle.
 * Les commandes sont idempotentes (une seconde exécution ne trouve plus rien) et travaillent par lots.
 */
abstract class RetentionCommand extends Command
{
    protected const BATCH = 200;

    protected function audit(AuditLogger $audit, string $event, int $count, Carbon $threshold): void
    {
        if ($count > 0) {
            $audit->record($event, context: [
                'command' => $this->getName(),
                'count' => $count,
                'threshold_date' => $threshold->toIso8601String(),
            ]);
        }
    }
}
