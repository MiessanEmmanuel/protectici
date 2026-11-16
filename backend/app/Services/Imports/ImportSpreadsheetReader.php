<?php

namespace App\Services\Imports;

use App\Support\Imports\ImportColumns;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;
use PhpOffice\PhpSpreadsheet\RichText\RichText;
use Throwable;
use ZipArchive;

/**
 * Lecture sûre d'un classeur .xlsx téléversé (security.md §6, plan §6.4) :
 *  - signature ZIP réelle, parties OOXML attendues, pas de macro, taille décompressée plafonnée (bombe ZIP) ;
 *  - valeurs seulement (readDataOnly) : une cellule formule donne sa DERNIÈRE VALEUR ENREGISTRÉE, jamais évaluée ;
 *  - lignes et colonnes bornées par un filtre de lecture ; l'analyseur XML de PhpSpreadsheet refuse les entités.
 */
class ImportSpreadsheetReader
{
    /** Plafond de lecture : au-delà, la ligne n'est même pas chargée (le contrôle des 2 000 lignes se fait avant). */
    private const ROW_LIMIT = 20000;

    private const COLUMN_LIMIT = 60;

    private const MAX_CELL_LENGTH = 10000;

    /**
     * Vérifie le conteneur et lit la feuille « Fiches » (à défaut, la première).
     *
     * @return array{headers: array<int, string>, rows: array<int, array<int, string>>} lignes indexées par n° Excel
     *
     * @throws ImportFileException
     */
    public function read(string $path): array
    {
        $this->inspect($path);

        try {
            $reader = new Xlsx;
            $reader->setReadDataOnly(true);
            $reader->setReadEmptyCells(false);
            $reader->setIncludeCharts(false);

            $names = $reader->listWorksheetNames($path);
            $sheetName = $names[0] ?? null;
            foreach ($names as $name) {
                if (ImportColumns::normalize($name) === 'fiches') {
                    $sheetName = $name;
                    break;
                }
            }
            if ($sheetName === null) {
                throw new ImportFileException('Le classeur ne contient aucune feuille.');
            }

            $reader->setLoadSheetsOnly([$sheetName]);
            $reader->setReadFilter(new class(self::ROW_LIMIT, self::COLUMN_LIMIT) implements IReadFilter
            {
                public function __construct(private readonly int $rows, private readonly int $columns) {}

                public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
                {
                    return $row <= $this->rows && Coordinate::columnIndexFromString($columnAddress) <= $this->columns;
                }
            });

            $spreadsheet = $reader->load($path);
        } catch (ImportFileException $e) {
            throw $e;
        } catch (Throwable) {
            throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) lisible.');
        }

        $sheet = $spreadsheet->getActiveSheet();
        $cells = [];
        foreach ($sheet->getCellCollection()->getCoordinates() as $coordinate) {
            $cell = $sheet->getCell($coordinate);
            $value = $this->value($cell);
            if ($value !== '') {
                $cells[$cell->getRow()][Coordinate::columnIndexFromString($cell->getColumn())] = $value;
            }
        }
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        ksort($cells);
        $headers = $cells[1] ?? [];
        unset($cells[1]);
        foreach ($cells as &$row) {
            ksort($row);
        }
        unset($row);
        ksort($headers);

        return ['headers' => $headers, 'rows' => $cells];
    }

    /**
     * Contrôles du conteneur ZIP avant toute lecture XML.
     *
     * @throws ImportFileException
     */
    public function inspect(string $path): void
    {
        $handle = @fopen($path, 'rb');
        $magic = $handle === false ? '' : (string) fread($handle, 4);
        if ($handle !== false) {
            fclose($handle);
        }
        if ($magic !== "PK\x03\x04") {
            throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) valide.');
        }

        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) valide.');
        }

        try {
            $maxEntries = (int) config('imports.max_zip_entries', 500);
            $maxBytes = (int) config('imports.max_uncompressed_bytes', 50 * 1024 * 1024);
            if ($zip->numFiles < 1 || $zip->numFiles > $maxEntries) {
                throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) valide.');
            }

            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) valide.');
                }
                $total += (int) $stat['size'];
                if ($total > $maxBytes) {
                    throw new ImportFileException('Le contenu du classeur est trop volumineux une fois décompressé.');
                }
                if (str_ends_with(strtolower((string) $stat['name']), 'vbaproject.bin')) {
                    throw new ImportFileException('Les classeurs contenant des macros ne sont pas acceptés.');
                }
            }

            if ($zip->locateName('[Content_Types].xml') === false || $zip->locateName('xl/workbook.xml') === false) {
                throw new ImportFileException('Le fichier n\'est pas un classeur Excel (.xlsx) valide.');
            }
        } finally {
            $zip->close();
        }
    }

    /** Valeur textuelle d'une cellule, sans jamais calculer de formule. */
    private function value(Cell $cell): string
    {
        $raw = $cell->getDataType() === DataType::TYPE_FORMULA ? $cell->getOldCalculatedValue() : $cell->getValue();

        if ($raw instanceof RichText) {
            $raw = $raw->getPlainText();
        }
        if (is_bool($raw)) {
            return $raw ? 'Oui' : 'Non';
        }
        if (is_float($raw)) {
            $raw = (floor($raw) === $raw && abs($raw) < 1e15) ? sprintf('%.0f', $raw) : (string) $raw;
        }
        if (is_int($raw)) {
            $raw = (string) $raw;
        }
        if (! is_string($raw)) {
            return '';
        }
        if (str_starts_with($raw, '#') && in_array($raw, ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#SPILL!', '#CALC!'], true)) {
            return '';
        }

        return trim(mb_substr($raw, 0, self::MAX_CELL_LENGTH));
    }
}
