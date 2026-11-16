<?php

namespace App\Jobs;

use App\Models\EstablishmentImport;
use App\Services\Imports\EstablishmentImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Création des fiches d'un import confirmé (contrat §10.2) : `importing` => `done` (ou `failed`). */
class RunEstablishmentImport implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [30, 120];

    public int $timeout = 900;

    public function __construct(public readonly int $importId, public readonly ?int $reviewerId)
    {
        $this->afterCommit();
    }

    public function handle(EstablishmentImporter $importer): void
    {
        $import = EstablishmentImport::query()->find($this->importId);
        if ($import !== null) {
            $importer->run($import, $this->reviewerId);
        }
    }

    public function failed(?Throwable $e): void
    {
        Log::error('Import de fiches en échec.', ['import_id' => $this->importId, 'exception' => $e === null ? null : $e::class]);

        EstablishmentImport::query()->whereKey($this->importId)->where('status', 'importing')->update([
            'status' => 'failed',
            'failure_message' => 'La création des fiches a été interrompue. Les fiches déjà créées sont conservées.',
            'finished_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
