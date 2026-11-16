<?php

use App\Services\Imports\ImportSpreadsheetReader;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

it('lit un classeur et indexe les cellules par numéro de colonne (1 = A, 27 = AA)', function () {
    $spreadsheet = new Spreadsheet;
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Fiches');
    $sheet->setCellValue('A1', 'Nom*');
    $sheet->setCellValue('C1', 'Ville*');
    $sheet->setCellValue('AA1', 'Notes');
    $sheet->setCellValue('A2', 'Sentinelle Démo');
    $sheet->setCellValue('C2', 'Abidjan');
    $sheet->setCellValue('AA2', 'Fictif');

    $path = tempnam(sys_get_temp_dir(), 'import').'.xlsx';
    (new Xlsx($spreadsheet))->save($path);

    try {
        $result = (new ImportSpreadsheetReader)->read($path);
    } finally {
        @unlink($path);
    }

    expect($result['headers'])->toBe([1 => 'Nom*', 3 => 'Ville*', 27 => 'Notes'])
        ->and($result['rows'])->toBe([2 => [1 => 'Sentinelle Démo', 3 => 'Abidjan', 27 => 'Fictif']]);
});
