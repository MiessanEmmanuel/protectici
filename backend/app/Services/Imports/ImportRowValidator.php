<?php

namespace App\Services\Imports;

use App\Enums\EstablishmentType;
use App\Rules\PhoneNumber;
use App\Support\Establishments\EstablishmentSchema;
use App\Support\Imports\ImportColumns;
use App\Support\PlainText;
use Illuminate\Support\Facades\Validator;

/**
 * Normalisation et validation d'une ligne du fichier. Les règles des champs simples sont celles de l'inscription
 * d'établissement (EstablishmentSchema, en mode partiel) ; les colonnes à liste fermée sont résolues par libellé
 * dans les référentiels visibles. Toute cellule est traitée comme du texte non fiable (balises retirées, bornée).
 */
class ImportRowValidator
{
    /** Emprise de la Côte d'Ivoire (avec une marge) pour les coordonnées saisies. */
    public const LAT_MIN = 4.0;

    public const LAT_MAX = 11.0;

    public const LNG_MIN = -9.0;

    public const LNG_MAX = -2.0;

    private const YES = ['oui', 'o', 'yes', 'y', '1', 'vrai', 'true', 'x'];

    private const NO = ['non', 'n', 'no', '0', 'faux', 'false'];

    /** Champs scalaires validés par les règles d'EstablishmentSchema. */
    private const SCHEMA_FIELDS = [
        'name', 'description', 'address', 'geo_description', 'phone', 'phone_alt', 'emergency_phone', 'email',
        'lat', 'lng', 'whatsapp_number', 'website_url', 'price_from', 'rccm', 'approval_number', 'legal_form',
    ];

    public function __construct(private readonly ImportReferenceLists $lists) {}

    /**
     * @param  array<string, string>  $values  cellules non vides de la ligne, par clé de colonne
     * @return array{data: array<string, mixed>, errors: list<array{column: string, message: string}>, city: string|null}
     */
    public function validate(EstablishmentType $type, array $values): array
    {
        $labels = ImportColumns::labels($type);
        $errors = [];
        $error = function (string $key, string $message) use (&$errors, $labels): void {
            $errors[] = ['column' => $labels[$key] ?? $key, 'message' => $message];
        };
        $data = [];

        foreach (ImportColumns::for($type) as $column) {
            if ($column['required'] && ($values[$column['key']] ?? '') === '') {
                $error($column['key'], 'Ce champ est obligatoire.');
            }
        }

        foreach (EstablishmentSchema::textFields($type) as $field => $mode) {
            if (isset($values[$field])) {
                $text = $mode === 'single' ? PlainText::single($values[$field]) : PlainText::multiline($values[$field]);
                if ($text !== '') {
                    $data[$field] = $text;
                }
            }
        }

        foreach (EstablishmentSchema::phoneFields($type) as $field) {
            if (isset($values[$field])) {
                $data[$field] = $this->phone($values[$field]);
            }
        }
        if (isset($values['email'])) {
            $data['email'] = mb_strtolower(PlainText::single($values['email']));
        }
        if (isset($values['website_url'])) {
            $url = PlainText::single($values['website_url']);
            $data['website_url'] = preg_match('#^[a-z][a-z0-9+.-]*://#i', $url) === 1 ? $url : 'https://'.$url;
        }
        if (isset($values['price_from'])) {
            $price = preg_replace('/(fcfa|f\s*cfa|xof|f)$/i', '', str_replace(["\u{00A0}", "\u{202F}", ' '], '', $values['price_from'])) ?? '';
            $data['price_from'] = preg_match('/^\d+$/', $price) === 1 ? (int) $price : $values['price_from'];
        }
        foreach (['lat', 'lng'] as $field) {
            if (isset($values[$field])) {
                $number = str_replace(',', '.', str_replace(' ', '', $values[$field]));
                $data[$field] = is_numeric($number) ? (float) $number : $values[$field];
            }
        }
        if (isset($values['legal_form'])) {
            $data['legal_form'] = $this->legalForm($values['legal_form']) ?? $values['legal_form'];
        }

        $this->resolveLists($type, $values, $data, $error);

        $short = $type === EstablishmentType::StateForce && isset($data['emergency_phone'])
            && preg_match(ImportColumns::SHORT_NUMBER, (string) $data['emergency_phone']) === 1;

        $schema = EstablishmentSchema::rules($type, true);
        $rules = array_intersect_key($schema, array_flip(array_intersect(self::SCHEMA_FIELDS, array_keys($data))));
        if ($short) {
            unset($rules['emergency_phone']);
        }

        $attributes = [];
        foreach (array_keys($rules) as $field) {
            $attributes[$field] = $labels[$field] ?? $field;
        }

        $validator = Validator::make($data, $rules, [], $attributes);
        foreach ($validator->errors()->messages() as $field => $messages) {
            $error((string) $field, (string) $messages[0]);
        }

        foreach (EstablishmentSchema::phoneFields($type) as $field) {
            $phone = $data[$field] ?? null;
            if (is_string($phone) && str_starts_with($phone, '+225') && preg_match('/^\+225\d{10}$/', $phone) !== 1 && ! $validator->errors()->has($field)) {
                $error($field, 'Le numéro ivoirien doit comporter 10 chiffres (format attendu : +225XXXXXXXXXX).');
            }
        }

        $this->checkCoordinates($data, $error);

        return ['data' => $data, 'errors' => $errors, 'city' => isset($data['city_id']) ? $this->lists->cityName((int) $data['city_id']) : ($values['city'] ?? null)];
    }

    /**
     * Normalise un numéro : séparateurs retirés, 0 initial perdu par Excel rétabli, 225… / 00225… / 0X… => +225….
     * Les numéros courts (110, 111, 170…) sont laissés tels quels.
     */
    public function phone(string $value): string
    {
        $phone = preg_replace('/[\s.\-()\/\x{00A0}\x{202F}]/u', '', trim($value)) ?? '';
        if (preg_match('/^[1-9]\d{8}$/', $phone) === 1) {
            $phone = '0'.$phone;
        }
        if (preg_match('/^225\d{10}$/', $phone) === 1) {
            $phone = '+'.$phone;
        }

        return (string) PhoneNumber::normalize($phone);
    }

    private function legalForm(string $value): ?string
    {
        $needle = ImportColumns::normalize($value);
        foreach (ImportColumns::LEGAL_FORMS as $label => $code) {
            if ($needle === ImportColumns::normalize($label) || $needle === $code) {
                return $code;
            }
        }

        return null;
    }

    /**
     * @param  array<string, string>  $values
     * @param  array<string, mixed>  $data
     * @param  callable(string, string): void  $error
     */
    private function resolveLists(EstablishmentType $type, array $values, array &$data, callable $error): void
    {
        if (isset($values['city'])) {
            $cityId = $this->lists->find('cities', $values['city']);
            if ($cityId === null) {
                $error('city', 'Ville inconnue : « '.PlainText::single($values['city']).' ».');
            } else {
                $data['city_id'] = $cityId;
            }
        }

        if (isset($values['district']) && isset($data['city_id'])) {
            [$districtId, $elsewhere] = $this->lists->findDistrict($values['district'], (int) $data['city_id']);
            if ($districtId !== null) {
                $data['district_id'] = $districtId;
            } elseif ($elsewhere !== null) {
                $error('district', 'La commune « '.PlainText::single($values['district']).' » n\'appartient pas à la ville « '.$this->lists->cityName((int) $data['city_id']).' ».');
            } else {
                $error('district', 'Commune ou quartier inconnu : « '.PlainText::single($values['district']).' ».');
            }
        }

        if ($type === EstablishmentType::StateForce) {
            if (isset($values['force_type'])) {
                $id = $this->lists->find('state_force_types', $values['force_type']);
                if ($id === null) {
                    $error('force_type', 'Type de force inconnu : « '.PlainText::single($values['force_type']).' ».');
                } else {
                    $data['force_type_id'] = $id;
                }
            }
            $this->multi('procedure_types', 'procedure_type_ids', 30, $values, $data, $error);
            if (isset($values['is_open_24h'])) {
                $answer = ImportColumns::normalize($values['is_open_24h']);
                if (in_array($answer, self::YES, true)) {
                    $data['is_open_24h'] = true;
                } elseif (in_array($answer, self::NO, true)) {
                    $data['is_open_24h'] = false;
                } else {
                    $error('is_open_24h', 'Répondez « Oui » ou « Non ».');
                }
            }

            return;
        }

        $this->multi('company_types', 'company_type_ids', 10, $values, $data, $error);
        $this->multi('service_types', 'service_type_ids', 40, $values, $data, $error);
    }

    /**
     * @param  array<string, string>  $values
     * @param  array<string, mixed>  $data
     * @param  callable(string, string): void  $error
     */
    private function multi(string $key, string $field, int $max, array $values, array &$data, callable $error): void
    {
        if (! isset($values[$key])) {
            return;
        }

        $parts = array_values(array_filter(array_map('trim', preg_split('/[;\n]+/', $values[$key]) ?: [])));
        $ids = [];
        $unknown = [];
        foreach ($parts as $part) {
            $id = $this->lists->find($key, $part);
            if ($id === null) {
                $unknown[] = PlainText::single($part);
            } else {
                $ids[$id] = $id;
            }
        }

        if ($unknown !== []) {
            $error($key, (count($unknown) > 1 ? 'Valeurs inconnues : « ' : 'Valeur inconnue : « ').implode(' », « ', array_slice($unknown, 0, 5)).' ».');
        } elseif (count($ids) > $max) {
            $error($key, "Au plus {$max} valeurs sont acceptées.");
        } else {
            $data[$field] = array_values($ids);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  callable(string, string): void  $error
     */
    private function checkCoordinates(array $data, callable $error): void
    {
        $lat = $data['lat'] ?? null;
        $lng = $data['lng'] ?? null;
        if ($lat === null && $lng === null) {
            return;
        }
        if ($lat === null || $lng === null) {
            $error($lat === null ? 'lat' : 'lng', 'La latitude et la longitude doivent être renseignées ensemble.');

            return;
        }
        if (! is_float($lat) || ! is_float($lng)) {
            return; // déjà signalé par la règle numeric
        }
        if ($lat < self::LAT_MIN || $lat > self::LAT_MAX || $lng < self::LNG_MIN || $lng > self::LNG_MAX) {
            $error('lat', 'Les coordonnées doivent se situer en Côte d\'Ivoire (latitude 4 à 11, longitude -9 à -2).');
        }
    }
}
