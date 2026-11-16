<?php

namespace App\Jobs;

use App\Models\EstablishmentImport;
use App\Services\Imports\EstablishmentImportAnalyzer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Analyse d'un fichier d'import téléversé (contrat §10.2) : `analyzing` => `ready` ou `failed`. */
class AnalyzeEstablishmentImport implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(public readonly int $importId)
    {
        $this->afterCommit();
    }

    public function handle(EstablishmentImportAnalyzer $analyzer): void
    {
        $import = EstablishmentImport::query()->find($this->importId);
        if ($import === null || $import->status !== 'analyzing') {
            return;
        }

        $analyzer->analyze($import);
    }

    public function failed(?Throwable $e): void
    {
        // Aucune donnée du fichier dans le journal : seulement l'identifiant du lot et le type d'erreur.
        Log::error('Analyse d\'import en échec.', ['import_id' => $this->importId, 'exception' => $e === null ? null : $e::class]);

        EstablishmentImport::query()->whereKey($this->importId)->where('status', 'analyzing')->update([
            'status' => 'failed',
            'failure_message' => 'L\'analyse du fichier a échoué. Vérifiez le fichier puis réessayez.',
            'updated_at' => now(),
        ]);
    }
}
