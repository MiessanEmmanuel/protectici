<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Support\Imports\ImportColumns;

/**
 * Lecture d'un fichier d'import : en-têtes reconnus par libellé (casse, accents, ponctuation et astérisque
 * ignorés, colonnes dans n'importe quel ordre, colonnes inconnues ignorées), puis lignes par clé de colonne.
 */
class EstablishmentImportParser
{
    public function __construct(
        private readonly ImportSpreadsheetReader $reader,
        private readonly ImportRowValidator $validator,
    ) {}

    /**
     * Contrôles du téléversement : conteneur, en-têtes obligatoires, nombre de lignes.
     *
     * @return array{columns: array<int, string>, rows: array<int, array<string, string>>, headers: array<int, string>}
     *
     * @throws ImportFileException
     */
    public function read(EstablishmentType $type, string $path): array
    {
        $sheet = $this->reader->read($path);
        $columns = $this->mapHeaders($type, $sheet['headers']);

        $rows = [];
        foreach ($sheet['rows'] as $line => $cells) {
            $values = [];
            foreach ($columns as $index => $key) {
                if (isset($cells[$index]) && $cells[$index] !== '') {
                    $values[$key] = $cells[$index];
                }
            }
            // Ligne sans aucune valeur dans une colonne reconnue : ignorée (lignes de mise en forme, notes à côté).
            if ($values !== [] && ! self::isExample($values)) {
                $rows[(int) $line] = $values;
            }
        }

        if ($rows === []) {
            throw new ImportFileException('Le fichier ne contient aucune ligne de données.');
        }
        $max = (int) config('imports.max_rows', ImportColumns::MAX_ROWS);
        if (count($rows) > $max) {
            throw new ImportFileException("Le fichier contient plus de {$max} lignes de données : découpez-le en plusieurs fichiers.");
        }

        return ['columns' => $columns, 'rows' => $rows, 'headers' => $sheet['headers']];
    }

    /**
     * Lecture et validation de chaque ligne.
     *
     * @return array{columns: array<int, string>, headers: array<int, string>, rows: array<int, array{values: array<string, string>, data: array<string, mixed>, errors: list<array{column: string, message: string}>, city: string|null}>}
     *
     * @throws ImportFileException
     */
    public function parse(EstablishmentType $type, string $path): array
    {
        $file = $this->read($type, $path);
        $rows = [];
        foreach ($file['rows'] as $line => $values) {
            $rows[$line] = ['values' => $values] + $this->validator->validate($type, $values);
        }

        return ['columns' => $file['columns'], 'headers' => $file['headers'], 'rows' => $rows];
    }

    /** Ligne d'exemple du modèle laissée par mégarde : jamais importée. */
    public const EXAMPLE_PREFIX = 'EXEMPLE à supprimer';

    /** @param array<string, string> $values */
    public static function isExample(array $values): bool
    {
        return str_starts_with(ImportColumns::normalize($values['name'] ?? ''), ImportColumns::normalize(self::EXAMPLE_PREFIX));
    }

    /**
     * @param  array<int, string>  $headers  index de colonne => libellé lu
     * @return array<int, string> index de colonne => clé
     *
     * @throws ImportFileException
     */
    public function mapHeaders(EstablishmentType $type, array $headers): array
    {
        $map = ImportColumns::headerMap($type);
        $labels = ImportColumns::labels($type);
        $columns = [];
        foreach ($headers as $index => $header) {
            $key = $map[ImportColumns::normalize($header)] ?? null;
            if ($key === null) {
                continue;
            }
            if (in_array($key, $columns, true)) {
                throw new ImportFileException('La colonne « '.$labels[$key].' » apparaît plusieurs fois.');
            }
            $columns[(int) $index] = $key;
        }

        $missing = [];
        foreach (ImportColumns::for($type) as $column) {
            if ($column['required'] && ! in_array($column['key'], $columns, true)) {
                $missing[] = $column['label'];
            }
        }
        if ($missing !== []) {
            throw new ImportFileException((count($missing) > 1 ? 'Colonnes obligatoires absentes : « ' : 'Colonne obligatoire absente : « ')
                .implode(' », « ', $missing).' ». Utilisez le modèle téléchargeable.');
        }

        return $columns;
    }
}
