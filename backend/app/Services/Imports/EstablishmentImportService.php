<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Exceptions\ApiHttpException;
use App\Jobs\AnalyzeEstablishmentImport;
use App\Jobs\RunEstablishmentImport;
use App\Models\EstablishmentImport;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PublicCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cycle de vie d'un import (contrat §10.2) : téléversement, décisions sur les doublons, confirmation idempotente,
 * annulation. Les transitions d'état se font sous verrou de ligne ; une opération de masse est journalisée par
 * un seul événement d'audit (contexte : identifiant du lot et compteurs, jamais de contenu du fichier).
 */
class EstablishmentImportService
{
    public function __construct(
        private readonly ImportFileStore $files,
        private readonly AuditLogger $audit,
    ) {}

    public function upload(User $admin, EstablishmentType $type, string $publishMode, UploadedFile $file): EstablishmentImport
    {
        $path = $this->files->store($file);

        $import = new EstablishmentImport;
        $import->forceFill([
            'type' => $type->value,
            'status' => 'analyzing',
            'publish_mode' => $publishMode,
            'file_disk' => $this->files->disk(),
            'file_path' => $path,
            'original_name' => $this->safeName($file->getClientOriginalName()),
            'created_by' => $admin->id,
        ])->save();

        $this->audit->record('establishment_import_uploaded', null, null, null, [
            'import_id' => $import->id, 'type' => $type->value, 'publish_mode' => $publishMode,
        ], $admin);

        return $import;
    }

    public function startAnalysis(EstablishmentImport $import): void
    {
        AnalyzeEstablishmentImport::dispatch($import->id);
    }

    /**
     * Décisions « ignorer » / « créer » sur les doublons. Un doublon de RCCM ou de n° d'agrément ne peut pas être
     * créé (valeurs uniques en base).
     *
     * @param  list<array{line: int, decision: string}>  $decisions
     */
    public function decide(EstablishmentImport $import, array $decisions): EstablishmentImport
    {
        return DB::transaction(function () use ($import, $decisions) {
            $locked = $this->lock($import);
            if ($locked->status !== 'ready') {
                throw new ApiHttpException(409, 'Cet import n\'est plus modifiable.');
            }

            $report = $locked->report ?? ['rows' => []];
            $index = [];
            foreach ($report['rows'] as $i => $row) {
                $index[(int) $row['line']] = $i;
            }

            $errors = [];
            foreach ($decisions as $n => $decision) {
                $i = $index[(int) $decision['line']] ?? null;
                if ($i === null || $report['rows'][$i]['status'] !== 'duplicate') {
                    $errors["decisions.{$n}.line"] = ['La ligne '.$decision['line'].' n\'est pas un doublon de cet import.'];

                    continue;
                }
                if ($decision['decision'] === 'create' && ($report['rows'][$i]['blocking'] ?? false)) {
                    $errors["decisions.{$n}.decision"] = ['La ligne '.$decision['line'].' reprend le RCCM ou le n° d\'agrément d\'une autre fiche : elle ne peut pas être créée.'];

                    continue;
                }
                $report['rows'][$i]['decision'] = $decision['decision'];
            }
            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }

            $locked->forceFill(['report' => $report])->save();

            return $locked;
        });
    }

    /**
     * Confirmation idempotente : [import, lancé maintenant ?]. Déjà `importing` / `done` : rien n'est relancé.
     *
     * @return array{0: EstablishmentImport, 1: bool}
     */
    public function confirm(EstablishmentImport $import, User $admin): array
    {
        $result = DB::transaction(function () use ($import, $admin) {
            $locked = $this->lock($import);

            if (in_array($locked->status, ['importing', 'done'], true)) {
                return [$locked, false];
            }
            if ($locked->status !== 'ready') {
                throw new ApiHttpException(409, match ($locked->status) {
                    'analyzing', 'uploaded' => 'L\'analyse du fichier n\'est pas terminée.',
                    'cancelled' => 'Cet import a été annulé.',
                    default => 'Cet import a échoué : corrigez le fichier puis téléversez-le à nouveau.',
                });
            }
            if (self::rowsToCreate($locked->report) === 0) {
                throw new ApiHttpException(409, 'Aucune ligne à créer dans cet import.');
            }
            if (! $this->files->exists($locked)) {
                throw new ApiHttpException(409, 'Le fichier d\'import n\'est plus disponible : téléversez-le à nouveau.');
            }

            $locked->forceFill(['status' => 'importing', 'confirmed_at' => now()])->save();
            $this->audit->record('establishment_import_confirmed', null, null, null, [
                'import_id' => $locked->id, 'type' => $locked->type, 'publish_mode' => $locked->publish_mode,
                'rows_to_create' => self::rowsToCreate($locked->report),
            ], $admin);

            return [$locked, true];
        });

        return $result;
    }

    public function startImport(EstablishmentImport $import, User $admin): void
    {
        RunEstablishmentImport::dispatch($import->id, $admin->id);
    }

    /**
     * Annulation : `ready` / `failed` => `cancelled` ; `done` => `cancelled_at` posé. Dans les deux cas, les fiches
     * du lot encore sans propriétaire et sans avis sont supprimées logiquement (un import en échec a pu en créer).
     *
     * @return array{0: EstablishmentImport, 1: int} [import, fiches supprimées]
     */
    public function cancel(EstablishmentImport $import, User $admin): array
    {
        $result = DB::transaction(function () use ($import, $admin) {
            $locked = $this->lock($import);
            $cancellable = in_array($locked->status, ['ready', 'failed'], true)
                || ($locked->status === 'done' && $locked->cancelled_at === null);
            if (! $cancellable) {
                throw new ApiHttpException(409, 'Cet import ne peut pas être annulé.');
            }

            $now = now();
            $deleted = $locked->type === EstablishmentType::Provider->value
                ? Provider::query()->where('import_id', $locked->id)->whereNull('user_id')->whereDoesntHave('reviews')
                    ->toBase()->update(['deleted_at' => $now, 'updated_at' => $now])
                : StateForce::query()->where('import_id', $locked->id)->whereNull('user_id')
                    ->toBase()->update(['deleted_at' => $now, 'updated_at' => $now]);

            $locked->forceFill([
                'status' => $locked->status === 'done' ? 'done' : 'cancelled',
                'cancelled_at' => $now,
            ])->save();

            $this->audit->record('establishment_import_cancelled', null, null, null, [
                'import_id' => $locked->id, 'type' => $locked->type, 'deleted_count' => $deleted,
            ], $admin);

            return [$locked, $deleted];
        });

        if ($result[1] > 0) {
            PublicCache::bump(PublicCache::DIRECTORY);
        }

        return $result;
    }

    /** @param array<string, mixed>|null $report */
    public static function rowsToCreate(?array $report): int
    {
        return count(array_filter($report['rows'] ?? [], fn (array $row) => EstablishmentImporter::shouldCreate($row)));
    }

    private function lock(EstablishmentImport $import): EstablishmentImport
    {
        /** @var EstablishmentImport */
        return EstablishmentImport::query()->lockForUpdate()->findOrFail($import->id);
    }

    /** Nom d'origine conservé pour l'affichage uniquement (jamais utilisé comme chemin). */
    private function safeName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', '', $name) ?? '';
        $name = trim(mb_substr($name, 0, 200));

        return $name === '' ? 'import.xlsx' : $name;
    }
}
