<?php

namespace App\Services\Imports;

use App\Models\EstablishmentImport;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Rapport d'erreurs : lignes du fichier d'origine + colonne « Erreurs », pour corriger puis réimporter.
 * Toutes les cellules sont écrites comme du texte et celles qui commencent par = + - @ (ou une tabulation /
 * un retour chariot) sont préfixées d'une apostrophe : aucune formule ne peut s'exécuter à l'ouverture.
 */
class ImportReportExporter
{
    public function __construct(
        private readonly ImportSpreadsheetReader $reader,
        private readonly ImportFileStore $files,
    ) {}

    /** @throws ImportFileException fichier purgé ou illisible */
    public function write(EstablishmentImport $import, string $target): void
    {
        $sheetData = $this->files->withLocalCopy($import, fn (string $path) => $this->reader->read($path));

        $messages = [];
        foreach ($import->report['rows'] ?? [] as $row) {
            $messages[(int) $row['line']] = $this->describe($row);
        }

        $width = max([1, ...array_keys($sheetData['headers']), ...array_map(fn (array $r) => $r === [] ? 1 : max(array_keys($r)), $sheetData['rows'])]);
        $errorColumn = Coordinate::stringFromColumnIndex($width + 1);

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Fiches');

        for ($c = 1; $c <= $width; $c++) {
            $this->put($sheet, Coordinate::stringFromColumnIndex($c).'1', $sheetData['headers'][$c] ?? '');
        }
        $this->put($sheet, $errorColumn.'1', 'Erreurs');
        $sheet->getStyle('A1:'.$errorColumn.'1')->getFont()->setBold(true);
        $sheet->getStyle($errorColumn.'1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFCA5A5');
        $sheet->getColumnDimension($errorColumn)->setWidth(80);

        $out = 2;
        foreach ($sheetData['rows'] as $line => $cells) {
            if (! isset($messages[$line])) {
                continue; // ligne vide ou d'exemple : absente du rapport
            }
            for ($c = 1; $c <= $width; $c++) {
                if (isset($cells[$c])) {
                    $this->put($sheet, Coordinate::stringFromColumnIndex($c).$out, $cells[$c]);
                }
            }
            $this->put($sheet, $errorColumn.$out, $messages[$line]);
            $out++;
        }
        $sheet->freezePane('A2');

        $writer = new Xlsx($spreadsheet);
        $writer->setPreCalculateFormulas(false);
        $writer->save($target);
        $spreadsheet->disconnectWorksheets();
    }

    /** Neutralise l'injection de formules (CSV/Excel injection). */
    public static function neutralize(string $value): string
    {
        return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }

    /** @param array<string, mixed> $row */
    private function describe(array $row): string
    {
        if (($row['status'] ?? null) === 'invalid') {
            return implode(' | ', array_map(fn (array $e) => $e['column'].' : '.$e['message'], $row['errors'] ?? []));
        }
        if (($row['status'] ?? null) === 'duplicate' && is_array($row['duplicate_of'] ?? null)) {
            $d = $row['duplicate_of'];
            $what = $d['type'] === 'row' ? 'ligne '.$d['id'].' du fichier' : 'fiche existante « '.$d['name'].' »'.($d['city'] ? ' ('.$d['city'].')' : '');

            return 'Doublon probable : '.$what.'.';
        }

        return '';
    }

    private function put(Worksheet $sheet, string $cell, string $value): void
    {
        $sheet->setCellValueExplicit($cell, self::neutralize($value), DataType::TYPE_STRING);
    }
}
