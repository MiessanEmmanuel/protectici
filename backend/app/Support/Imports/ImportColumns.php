<?php

namespace App\Support\Imports;

use App\Enums\EstablishmentType;

/**
 * Colonnes des modèles d'import Excel (contrat §10.2). Les en-têtes sont reconnus par libellé, sans tenir compte
 * de la casse, des accents, de la ponctuation ni de l'astérisque (voir normalize()) ; quelques alias tolérés.
 *
 * Chaque colonne : key (champ interne), label (en-tête du modèle), required, list (source de liste déroulante
 * ou null), multi (valeurs séparées par « ; »), aliases.
 */
final class ImportColumns
{
    public const MAX_ROWS = 2000;

    /** Valeurs de la colonne « Forme juridique » : libellé => valeur en base. */
    public const LEGAL_FORMS = [
        'SARL' => 'sarl',
        'SA' => 'sa',
        'SAS' => 'sas',
        'SUARL' => 'suarl',
        'Entreprise individuelle' => 'ei',
        'Association' => 'association',
        'Autre' => 'other',
    ];

    /** Numéros courts d'urgence (110, 111, 170, 180, 185, 1308…), acceptés pour le numéro d'urgence des forces. */
    public const SHORT_NUMBER = '/^\d{3,4}$/';

    /**
     * @return list<array{key: string, label: string, required: bool, list: string|null, multi: bool, aliases: list<string>}>
     */
    public static function for(EstablishmentType $type): array
    {
        $c = fn (string $key, string $label, bool $required = false, ?string $list = null, bool $multi = false, array $aliases = []): array => [
            'key' => $key, 'label' => $label, 'required' => $required, 'list' => $list, 'multi' => $multi, 'aliases' => $aliases,
        ];

        $location = [
            $c('city', 'Ville', true, 'cities'),
            $c('district', 'Commune / quartier', false, 'districts', false, ['Commune', 'Quartier', 'Commune quartier']),
            $c('address', 'Adresse'),
            $c('geo_description', 'Description géographique'),
        ];

        if ($type === EstablishmentType::StateForce) {
            return [
                $c('name', 'Nom de la structure', true, null, false, ['Nom', 'Structure']),
                $c('force_type', 'Type de force', true, 'state_force_types'),
                ...$location,
                $c('phone', 'Téléphone', false, null, false, ['Telephone 1']),
                $c('phone_alt', 'Téléphone 2'),
                $c('emergency_phone', 'Numéro d\'urgence', false, null, false, ['Urgence']),
                $c('email', 'E-mail', false, null, false, ['Email', 'Courriel', 'Adresse e-mail']),
                $c('procedure_types', 'Démarches possibles', false, 'procedure_types', true, ['Démarches']),
                $c('is_open_24h', 'Ouvert 24 h/24', false, 'yes_no', false, ['Ouvert 24h/24', 'Ouvert 24h', '24h/24']),
                $c('lat', 'Latitude'),
                $c('lng', 'Longitude'),
                $c('description', 'Description'),
            ];
        }

        return [
            $c('name', 'Raison sociale', true, null, false, ['Nom', 'Nom de l\'entreprise']),
            $c('phone', 'Téléphone', true, null, false, ['Telephone 1']),
            ...$location,
            $c('phone_alt', 'Téléphone 2'),
            $c('emergency_phone', 'Numéro d\'urgence', false, null, false, ['Urgence']),
            $c('whatsapp_number', 'WhatsApp', false, null, false, ['Numéro WhatsApp']),
            $c('email', 'E-mail', false, null, false, ['Email', 'Courriel', 'Adresse e-mail']),
            $c('website_url', 'Site web', false, null, false, ['Site internet', 'Site']),
            $c('company_types', 'Types d\'entreprise', false, 'company_types', true, ['Type d\'entreprise']),
            $c('service_types', 'Services proposés', false, 'service_types', true, ['Services']),
            $c('price_from', 'Tarif de départ (FCFA)', false, null, false, ['Tarif de départ', 'Tarif']),
            $c('lat', 'Latitude'),
            $c('lng', 'Longitude'),
            $c('description', 'Description'),
            $c('rccm', 'RCCM'),
            $c('approval_number', 'N° d\'agrément', false, null, false, ['Numéro d\'agrément', 'Agrément']),
            $c('legal_form', 'Forme juridique', false, 'legal_forms'),
        ];
    }

    /**
     * Libellé affiché dans le modèle (astérisque sur les colonnes obligatoires).
     *
     * @param  array{label: string, required: bool}  $column
     */
    public static function headerLabel(array $column): string
    {
        return $column['label'].($column['required'] ? '*' : '');
    }

    /** @return array<string, string> clé => libellé français (sans astérisque) */
    public static function labels(EstablishmentType $type): array
    {
        $labels = [];
        foreach (self::for($type) as $column) {
            $labels[$column['key']] = $column['label'];
        }

        return $labels;
    }

    /**
     * Correspondance en-tête normalisé => clé (libellés puis alias).
     *
     * @return array<string, string>
     */
    public static function headerMap(EstablishmentType $type): array
    {
        $map = [];
        foreach (self::for($type) as $column) {
            $map[self::normalize($column['label'])] = $column['key'];
        }
        foreach (self::for($type) as $column) {
            foreach ($column['aliases'] as $alias) {
                $map[self::normalize($alias)] ??= $column['key'];
            }
        }

        return $map;
    }

    /** Forme comparable d'un texte : sans accents, minuscules, ponctuation et astérisques remplacés par des espaces. */
    public static function normalize(string $value): string
    {
        $value = str_replace(['°', 'º'], ' ', $value);
        $ascii = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $value);
        $ascii = is_string($ascii) ? $ascii : mb_strtolower($value);
        $ascii = preg_replace('/[^a-z0-9]+/', ' ', $ascii) ?? $ascii;

        return trim($ascii);
    }
}
