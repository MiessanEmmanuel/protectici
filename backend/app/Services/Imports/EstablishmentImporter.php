<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Jobs\GeocodeImportedEstablishment;
use App\Models\EstablishmentImport;
use App\Models\Provider;
use App\Models\StateForce;
use App\Services\AuditLogger;
use App\Services\Establishments\EstablishmentWriter;
use App\Support\PublicCache;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Création des fiches d'un import confirmé (job RunEstablishmentImport). Les lignes à créer sont celles du rapport
 * (valides, ou doublons non bloquants marqués « créer ») ; leurs données sont relues dans le fichier et revalidées.
 * Paquets de 100 lignes en transaction ; chaque fiche créée est notée dans le rapport (`created_id`) dans la même
 * transaction : une relance du job ne recrée jamais une fiche.
 */
class EstablishmentImporter
{
    public function __construct(
        private readonly EstablishmentImportParser $parser,
        private readonly ImportFileStore $files,
        private readonly EstablishmentWriter $writer,
        private readonly AuditLogger $audit,
    ) {}

    public function run(EstablishmentImport $import, ?int $reviewerId): void
    {
        if ($import->status !== 'importing') {
            return;
        }

        $type = EstablishmentType::from($import->type);

        try {
            $parsed = $this->files->withLocalCopy($import, fn (string $path) => $this->parser->parse($type, $path));
        } catch (ImportFileException $e) {
            $import->forceFill(['status' => 'failed', 'failure_message' => $e->getMessage(), 'finished_at' => now()])->save();

            return;
        }

        $lines = [];
        foreach ($import->report['rows'] ?? [] as $index => $row) {
            if (self::shouldCreate($row) && ($row['created_id'] ?? null) === null) {
                $lines[$index] = (int) $row['line'];
            }
        }

        foreach (array_chunk($lines, (int) config('imports.chunk_size', 100), true) as $chunk) {
            DB::transaction(function () use ($import, $type, $parsed, $chunk, $reviewerId): void {
                /** @var EstablishmentImport $locked */
                $locked = EstablishmentImport::query()->lockForUpdate()->findOrFail($import->id);
                $report = $locked->report ?? ['rows' => []];

                foreach ($chunk as $index => $line) {
                    $row = $parsed['rows'][$line] ?? null;
                    if ($row === null || $row['errors'] !== [] || ($report['rows'][$index]['created_id'] ?? null) !== null) {
                        $report['rows'][$index]['not_created'] = true;

                        continue;
                    }

                    try {
                        $model = DB::transaction(fn () => $this->create($locked, $type, $row['data'], $reviewerId));
                        $report['rows'][$index]['created_id'] = $model->id;
                    } catch (UniqueConstraintViolationException) {
                        // RCCM / n° d'agrément enregistré entre-temps : la ligne n'est pas créée.
                        $report['rows'][$index]['not_created'] = true;
                    }
                }

                $created = count(array_filter($report['rows'], fn (array $r) => ($r['created_id'] ?? null) !== null));
                $locked->forceFill(['report' => $report, 'rows_created' => $created])->save();
            });
        }

        $import->refresh();
        $import->forceFill(['status' => 'done', 'finished_at' => now()])->save();

        PublicCache::bump(PublicCache::DIRECTORY);
        $this->audit->record('establishment_import_completed', null, null, null, [
            'import_id' => $import->id, 'type' => $import->type, 'rows_created' => $import->rows_created,
        ]);

        $this->queueGeocoding($import, $type);
    }

    /** @param array<string, mixed> $row ligne du rapport */
    public static function shouldCreate(array $row): bool
    {
        return ($row['status'] ?? null) === 'valid'
            || (($row['status'] ?? null) === 'duplicate' && ($row['decision'] ?? null) === 'create' && ! ($row['blocking'] ?? false));
    }

    /** @param array<string, mixed> $data */
    private function create(EstablishmentImport $import, EstablishmentType $type, array $data, ?int $reviewerId): Provider|StateForce
    {
        $publish = $import->publish_mode === 'publish';
        $model = $type === EstablishmentType::Provider ? new Provider : new StateForce;

        $columns = [];
        foreach ($data as $field => $value) {
            if (! str_ends_with($field, '_ids')) {
                $columns[match ($field) {
                    'lat' => 'latitude',
                    'lng' => 'longitude',
                    default => $field,
                }] = $value;
            }
        }

        $model->forceFill($columns);
        $model->forceFill([
            'user_id' => null,
            'import_id' => $import->id,
            'slug' => $this->writer->uniqueSlug($type, (string) $data['name']),
            'status' => $publish ? 'approved' : 'pending',
            'is_visible' => $publish,
            'reviewed_by' => $publish ? $reviewerId : null,
            'reviewed_at' => $publish ? now() : null,
        ]);
        if ($model instanceof Provider) {
            $model->forceFill(['is_verified' => false, 'is_in_service' => true]);
        }
        $model->save();

        if ($model instanceof Provider) {
            $model->companyTypes()->sync($data['company_type_ids'] ?? []);
            $model->serviceTypes()->sync($data['service_type_ids'] ?? []);
        } else {
            $model->procedureTypes()->sync($data['procedure_type_ids'] ?? []);
        }

        return $model;
    }

    /** Géocodage en file des fiches créées sans coordonnées (1 requête/s : appels espacés + verrou du géocodeur). */
    private function queueGeocoding(EstablishmentImport $import, EstablishmentType $type): void
    {
        $delay = 0;
        $type->query()->where('import_id', $import->id)->whereNull('latitude')
            ->where(fn ($q) => $q->whereNotNull('address')->orWhereNotNull('district_id'))
            ->orderBy('id')->select('id')
            ->each(function (Provider|StateForce $model) use ($type, &$delay): void {
                GeocodeImportedEstablishment::dispatch($type->value, (int) $model->id)->delay(now()->addSeconds($delay++));
            });
    }
}
