<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Models\EstablishmentImport;

/**
 * Analyse d'un import (job AnalyzeEstablishmentImport) : validation de chaque ligne et doublons (base + fichier).
 * Le rapport `report.rows` ne contient JAMAIS de RCCM, n° d'agrément, téléphone ni e-mail : seulement le n° de
 * ligne, le nom, la ville, le statut, les erreurs (colonne + message) et le doublon probable.
 */
class EstablishmentImportAnalyzer
{
    public function __construct(
        private readonly EstablishmentImportParser $parser,
        private readonly ImportFileStore $files,
    ) {}

    public function analyze(EstablishmentImport $import): void
    {
        $type = EstablishmentType::from($import->type);

        try {
            $parsed = $this->files->withLocalCopy($import, fn (string $path) => $this->parser->parse($type, $path));
        } catch (ImportFileException $e) {
            $import->forceFill(['status' => 'failed', 'failure_message' => $e->getMessage()])->save();

            return;
        }

        $duplicates = new ImportDuplicateFinder($type);
        $rows = [];
        $counts = ['valid' => 0, 'invalid' => 0, 'duplicate' => 0];

        foreach ($parsed['rows'] as $line => $row) {
            $entry = [
                'line' => $line,
                'name' => isset($row['data']['name']) ? mb_substr((string) $row['data']['name'], 0, 200) : null,
                'city' => $row['city'] === null ? null : mb_substr($row['city'], 0, 120),
                'status' => 'valid',
                'errors' => $row['errors'],
                'duplicate_of' => null,
                'decision' => null,
                'blocking' => false,
                'created_id' => null,
            ];

            if ($row['errors'] !== []) {
                $entry['status'] = 'invalid';
            } elseif (($match = $duplicates->check($line, $row['data'], $row['city'])) !== null) {
                $entry['status'] = 'duplicate';
                $entry['duplicate_of'] = $match['duplicate_of'];
                $entry['blocking'] = $match['blocking'];
                $entry['decision'] = 'skip';
            }

            $counts[$entry['status']]++;
            $rows[] = $entry;
        }

        $import->forceFill([
            'status' => 'ready',
            'rows_total' => count($rows),
            'rows_valid' => $counts['valid'],
            'rows_invalid' => $counts['invalid'],
            'rows_duplicate' => $counts['duplicate'],
            'report' => ['rows' => $rows],
            'failure_message' => null,
        ])->save();
    }
}
