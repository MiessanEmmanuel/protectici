<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Support\Imports\ImportColumns;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Modèle Excel d'import, généré à la demande pour que les listes déroulantes reflètent la base :
 * feuille « Fiches » (en-tête figé, obligatoires marqués et colorés, ligne d'exemple factice, listes déroulantes),
 * feuille « Listes » (valeurs autorisées), feuille « Mode d'emploi ».
 */
class EstablishmentImportTemplate
{
    private const REQUIRED_FILL = 'FFF6C9A8';

    private const OPTIONAL_FILL = 'FFE5E7EB';

    public function __construct(private readonly ImportReferenceLists $lists) {}

    public static function filename(EstablishmentType $type): string
    {
        return $type === EstablishmentType::StateForce ? 'modele-import-forces-etatiques.xlsx' : 'modele-import-prestataires.xlsx';
    }

    /** Écrit le modèle dans $target (chemin ou php://output). */
    public function write(EstablishmentType $type, string $target): void
    {
        $spreadsheet = $this->build($type);
        $writer = new Xlsx($spreadsheet);
        $writer->setPreCalculateFormulas(false);
        $writer->save($target);
        $spreadsheet->disconnectWorksheets();
    }

    public function build(EstablishmentType $type): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getProperties()->setCreator('ProtectIci')->setTitle('Modèle d\'import ProtectIci');

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Fiches');
        $lists = $spreadsheet->createSheet();
        $lists->setTitle('Listes');
        $help = $spreadsheet->createSheet();
        $help->setTitle('Mode d\'emploi');

        $ranges = $this->fillLists($lists, $type);
        $this->fillSheet($sheet, $type, $ranges);
        $this->fillHelp($help, $type);

        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }

    /**
     * @return array<string, array{range: string|null, values: list<string>}> source => plage de la feuille Listes
     */
    private function fillLists(Worksheet $sheet, EstablishmentType $type): array
    {
        $ranges = [];
        $column = 1;
        foreach ($this->lists->sheetLists($type) as $source => $list) {
            $letter = Coordinate::stringFromColumnIndex($column);
            $sheet->setCellValue($letter.'1', $list['title']);
            $sheet->getStyle($letter.'1')->getFont()->setBold(true);
            $sheet->getColumnDimension($letter)->setWidth(36);
            foreach ($list['values'] as $i => $value) {
                $sheet->setCellValueExplicit($letter.($i + 2), $value, DataType::TYPE_STRING);
            }
            $count = count($list['values']);
            $ranges[$source] = [
                'range' => $count === 0 ? null : "'Listes'!\${$letter}\$2:\${$letter}\$".($count + 1),
                'values' => $list['values'],
            ];
            $column++;
        }
        $sheet->freezePane('A2');

        return $ranges;
    }

    /** @param array<string, array{range: string|null, values: list<string>}> $ranges */
    private function fillSheet(Worksheet $sheet, EstablishmentType $type, array $ranges): void
    {
        $max = (int) config('imports.max_rows', ImportColumns::MAX_ROWS) + 1;
        $example = $this->example($type, $ranges);

        foreach (ImportColumns::for($type) as $i => $column) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);
            $sheet->setCellValue($letter.'1', ImportColumns::headerLabel($column));
            $style = $sheet->getStyle($letter.'1');
            $style->getFont()->setBold(true);
            $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($column['required'] ? self::REQUIRED_FILL : self::OPTIONAL_FILL);
            $sheet->getColumnDimension($letter)->setWidth(in_array($column['key'], ['description', 'geo_description', 'service_types', 'procedure_types'], true) ? 40 : 24);

            if (! in_array($column['key'], ['lat', 'lng', 'price_from'], true)) {
                // Texte : un téléphone saisi ne perd pas son 0 initial.
                $sheet->getStyle("{$letter}2:{$letter}{$max}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
            }

            if (isset($example[$column['key']])) {
                $sheet->setCellValueExplicit($letter.'2', $example[$column['key']], DataType::TYPE_STRING);
            }

            $range = $column['list'] === null ? null : ($ranges[$column['list']]['range'] ?? null);
            if ($range !== null) {
                $validation = $sheet->getDataValidation("{$letter}2:{$letter}{$max}");
                $validation->setType(DataValidation::TYPE_LIST)
                    ->setAllowBlank(true)
                    ->setShowDropDown(true)
                    ->setFormula1($range)
                    ->setPromptTitle($column['label'])
                    ->setShowInputMessage(true)
                    ->setPrompt($column['multi'] ? 'Choisissez une valeur ou saisissez-en plusieurs séparées par « ; ».' : 'Choisissez une valeur dans la liste.');
                // Valeurs multiples : la saisie libre « a; b » doit rester possible.
                $validation->setShowErrorMessage(! $column['multi'])
                    ->setErrorStyle(DataValidation::STYLE_STOP)
                    ->setErrorTitle('Valeur non reconnue')
                    ->setError('Choisissez une valeur de la feuille « Listes ».');
            }
        }

        $last = Coordinate::stringFromColumnIndex(count(ImportColumns::for($type)));
        $sheet->getStyle("A2:{$last}2")->getFont()->setItalic(true)->getColor()->setARGB('FF6B7280');
        $sheet->freezePane('A2');
    }

    /**
     * Ligne d'exemple factice, construite à partir des premières valeurs des listes. Ignorée à l'import.
     *
     * @param  array<string, array{range: string|null, values: list<string>}>  $ranges
     * @return array<string, string>
     */
    private function example(EstablishmentType $type, array $ranges): array
    {
        $first = fn (string $source): string => $ranges[$source]['values'][0] ?? '';
        $two = fn (string $source): string => implode('; ', array_slice($ranges[$source]['values'] ?? [], 0, 2));
        $city = $first('cities');
        $district = '';
        foreach ($ranges['districts']['values'] ?? [] as $value) {
            if (str_ends_with($value, '('.$city.')')) {
                $district = $value;
                break;
            }
        }

        $common = [
            'city' => $city,
            'district' => $district,
            'address' => 'Boulevard de l\'Exemple, rue 12',
            'geo_description' => 'À côté de la pharmacie de l\'Exemple',
            'phone' => '07 00 00 00 01',
            'phone_alt' => '+225 05 00 00 00 02',
            'lat' => '5.3196',
            'lng' => '-4.0167',
        ];

        if ($type === EstablishmentType::StateForce) {
            return $common + [
                'name' => EstablishmentImportParser::EXAMPLE_PREFIX.' – Commissariat de l\'Exemple',
                'force_type' => $first('state_force_types'),
                'emergency_phone' => '110',
                'email' => 'commissariat.exemple@exemple.test',
                'procedure_types' => $two('procedure_types'),
                'is_open_24h' => 'Oui',
                'description' => 'Fiche d\'exemple fictive : cette ligne est ignorée à l\'import.',
            ];
        }

        return $common + [
            'name' => EstablishmentImportParser::EXAMPLE_PREFIX.' – Sécurité Exemple SARL',
            'emergency_phone' => '01 00 00 00 03',
            'whatsapp_number' => '07 00 00 00 01',
            'email' => 'contact@securite-exemple.test',
            'website_url' => 'https://securite-exemple.test',
            'company_types' => $first('company_types'),
            'service_types' => $two('service_types'),
            'price_from' => '150000',
            'description' => 'Fiche d\'exemple fictive : cette ligne est ignorée à l\'import.',
            'rccm' => 'CI-ABJ-0000-B-00000',
            'approval_number' => 'AGR-0000-000',
            'legal_form' => 'SARL',
        ];
    }

    private function fillHelp(Worksheet $sheet, EstablishmentType $type): void
    {
        $max = (int) config('imports.max_rows', ImportColumns::MAX_ROWS);
        $what = $type === EstablishmentType::StateForce ? 'forces étatiques' : 'prestataires';
        $required = implode(', ', array_map(fn (array $c) => '« '.$c['label'].' »', array_filter(ImportColumns::for($type), fn (array $c) => $c['required'])));
        $multi = implode(', ', array_map(fn (array $c) => '« '.$c['label'].' »', array_filter(ImportColumns::for($type), fn (array $c) => $c['multi'])));

        $lines = [
            "Mode d'emploi – import des {$what}",
            '',
            '1. Remplissez la feuille « Fiches » : une ligne par fiche. Gardez la ligne d\'en-tête : les colonnes peuvent être déplacées, mais leurs libellés doivent rester reconnaissables (majuscules, accents et astérisque indifférents).',
            "2. Colonnes obligatoires (marquées d'un astérisque et colorées) : {$required}.",
            '3. La ligne d\'exemple, dont le nom commence par « '.EstablishmentImportParser::EXAMPLE_PREFIX.' », est ignorée : vous pouvez la supprimer ou l\'écraser.',
            '4. Téléphones : numéro ivoirien à 10 chiffres (07 09 44 51 11) ou international (+225 07 09 44 51 11). Ils sont enregistrés au format +225XXXXXXXXXX. Un seul numéro par cellule.',
            "5. Valeurs multiples ({$multi}) : séparez-les par un point-virgule, par exemple « Gardiennage; Vidéosurveillance ».",
            '6. Ville, commune, types et listes : utilisez les valeurs de la feuille « Listes » (majuscules et accents indifférents). La commune doit appartenir à la ville indiquée ; écrivez « Commune (Ville) » ou simplement « Commune ».',
            '7. Coordonnées : latitude et longitude ensemble, en degrés décimaux (par exemple 5.3196 et -4.0167), situées en Côte d\'Ivoire. Sans coordonnées, la fiche est localisée automatiquement d\'après l\'adresse, la commune et la ville quand c\'est possible.',
            "8. Plafonds : {$max} lignes de données, 5 Mo, format .xlsx uniquement. Les formules ne sont pas calculées : seule la dernière valeur enregistrée dans le fichier est lue. Le texte (balises HTML comprises) est nettoyé.",
            '9. Après le téléversement, un aperçu indique les lignes valides, les erreurs (ligne, colonne, message) et les doublons probables (même nom dans la même ville, même téléphone, même e-mail'.($type === EstablishmentType::Provider ? ', même RCCM ou même n° d\'agrément' : '').'). Les lignes en erreur ne sont jamais importées : corrigez-les dans le rapport d\'erreurs puis réimportez-les.',
        ];

        if ($type === EstablishmentType::StateForce) {
            $lines[] = '10. Numéro d\'urgence : les numéros courts sont acceptés (110, 111, 170, 180…). « Ouvert 24 h/24 » : Oui ou Non. Les horaires détaillés se saisissent ensuite dans l\'administration.';
        } else {
            $lines[] = '10. « Tarif de départ (FCFA) » : nombre entier sans décimales. « Site web » : adresse http(s). RCCM et n° d\'agrément : facultatifs, confidentiels et uniques ; une fiche existante avec le même numéro ne peut pas être recréée.';
            $lines[] = '11. Dirigeants, réseaux sociaux, logo et justificatifs ne sont pas importés : ils s\'ajoutent ensuite depuis l\'administration ou l\'espace établissement.';
        }

        foreach ($lines as $i => $line) {
            $sheet->setCellValueExplicit('A'.($i + 1), $line, DataType::TYPE_STRING);
        }
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getColumnDimension('A')->setWidth(140);
        $sheet->getStyle('A1:A'.count($lines))->getAlignment()->setWrapText(true);
    }
}
