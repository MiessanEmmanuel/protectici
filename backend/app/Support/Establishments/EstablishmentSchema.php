<?php

namespace App\Support\Establishments;

use App\Enums\EstablishmentType;
use App\Rules\PhoneNumber;
use Illuminate\Validation\Rule;

/**
 * Définition unique des champs d'un établissement (contrat §7.2) : règles de validation, champs sensibles (RG2),
 * champs modifiables par le propriétaire, correspondance avec les colonnes. Tout champ absent de ces listes est
 * ignoré : status, is_visible, is_verified, is_featured, user_id, reviewed_* ne sont jamais écrits depuis le client.
 */
final class EstablishmentSchema
{
    public const LEGAL_FORMS = ['sarl', 'sa', 'sas', 'suarl', 'ei', 'association', 'other'];

    public const SUBMITTER_ROLES = ['manager', 'employee', 'other'];

    public const EXECUTIVE_POSITIONS = ['general_manager', 'commercial_manager', 'operations_manager', 'other'];

    public const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    /** Relations (identifiants) : jamais copiées telles quelles dans les colonnes. */
    public const RELATION_FIELDS = ['company_type_ids', 'service_type_ids', 'executives', 'procedure_type_ids', 'procedures'];

    /** Champs sensibles : modifiables uniquement par un admin ou via une demande de modification validée. */
    /** @return list<string> */
    public static function sensitive(EstablishmentType $type): array
    {
        return match ($type) {
            EstablishmentType::Provider => ['name', 'rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number'],
            EstablishmentType::StateForce => ['name', 'force_type_id'],
        };
    }

    /** Champs non sensibles que le propriétaire peut modifier (PATCH). */
    /** @return list<string> */
    public static function ownerEditable(EstablishmentType $type): array
    {
        return match ($type) {
            EstablishmentType::Provider => [
                'description', 'phone', 'phone_alt', 'emergency_phone', 'email', 'website_url', 'facebook_url',
                'instagram_url', 'twitter_url', 'linkedin_url', 'whatsapp_number', 'address', 'city_id',
                'district_id', 'geo_description', 'plus_code', 'lat', 'lng', 'price_from', 'approval_expires_at',
                'is_in_service', 'company_type_ids', 'service_type_ids', 'executives',
            ],
            EstablishmentType::StateForce => [
                'description', 'phone', 'phone_alt', 'emergency_phone', 'email', 'address', 'city_id',
                'district_id', 'geo_description', 'plus_code', 'lat', 'lng', 'opening_hours', 'is_open_24h',
                'procedure_type_ids', 'procedures',
            ],
        };
    }

    /** Tous les champs acceptés à la création (hors consentement, type et jeton anti-robot). */
    /** @return list<string> */
    public static function creatable(EstablishmentType $type): array
    {
        return array_values(array_unique([
            ...self::sensitive($type),
            ...self::ownerEditable($type),
            ...($type === EstablishmentType::Provider ? ['submitter_role'] : []),
        ]));
    }

    /** Champs texte libres (balises retirées) : [champ => 'single'|'multiline']. */
    /** @return array<string, string> */
    public static function textFields(EstablishmentType $type): array
    {
        $common = [
            'name' => 'single', 'address' => 'single', 'plus_code' => 'single',
            'description' => 'multiline', 'geo_description' => 'multiline',
        ];

        return $common + ($type === EstablishmentType::Provider
            ? ['rccm' => 'single', 'approval_number' => 'single', 'corporate_purpose' => 'multiline']
            : []);
    }

    /** Champs de numéro de téléphone normalisés avant validation (E.164). */
    /** @return list<string> */
    public static function phoneFields(EstablishmentType $type): array
    {
        return match ($type) {
            EstablishmentType::Provider => ['phone', 'phone_alt', 'emergency_phone', 'whatsapp_number'],
            EstablishmentType::StateForce => ['phone', 'phone_alt', 'emergency_phone'],
        };
    }

    /** Colonnes de la table pour un champ de l'API (lat/lng => latitude/longitude). */
    public static function column(string $field): string
    {
        return match ($field) {
            'lat' => 'latitude',
            'lng' => 'longitude',
            default => $field,
        };
    }

    /**
     * Règles de validation. $partial = true : tous les champs deviennent facultatifs (PATCH).
     *
     * @return array<string, mixed>
     */
    public static function rules(EstablishmentType $type, bool $partial): array
    {
        $required = fn (array $rules): array => $partial ? ['sometimes', ...array_filter($rules, fn ($r) => $r !== 'required')] : $rules;
        $optional = fn (array $rules): array => ['sometimes', 'nullable', ...$rules];

        $url = ['string', 'max:255', 'url:http,https'];
        $phone = ['string', 'max:30', new PhoneNumber];
        $visibleExists = fn (string $table) => Rule::exists($table, 'id')->where('is_visible', true);

        $rules = [
            'name' => $required(['required', 'string', 'min:2', 'max:200']),
            'description' => $optional(['string', 'max:5000']),
            'phone_alt' => $optional($phone),
            'emergency_phone' => $optional($phone),
            'email' => $optional(['string', 'email:rfc,strict', 'max:255']),
            'address' => $optional(['string', 'max:255']),
            'city_id' => $required(['required', 'integer', $visibleExists('cities')]),
            'district_id' => $optional(['integer', $visibleExists('districts')]),
            'geo_description' => $optional(['string', 'max:2000']),
            'plus_code' => $optional(['string', 'max:20', 'regex:/^[0-9A-Za-z+]{4,20}$/']),
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
        ];

        if ($type === EstablishmentType::Provider) {
            return $rules + [
                'phone' => $required(['required', ...$phone]),
                'company_type_ids' => $required(['required', 'array', 'min:1', 'max:10']),
                'company_type_ids.*' => ['integer', 'distinct', $visibleExists('company_types')],
                'service_type_ids' => $required(['required', 'array', 'min:1', 'max:40']),
                'service_type_ids.*' => ['integer', 'distinct', $visibleExists('service_types')],
                'submitter_role' => $required(['required', 'string', Rule::in(self::SUBMITTER_ROLES)]),
                'is_in_service' => $required(['required', 'boolean']),
                'website_url' => $optional($url),
                'facebook_url' => $optional($url),
                'instagram_url' => $optional($url),
                'twitter_url' => $optional($url),
                'linkedin_url' => $optional($url),
                'whatsapp_number' => $optional($phone),
                'price_from' => $optional(['integer', 'min:0', 'max:1000000000']),
                'rccm' => $optional(['string', 'max:50', 'regex:/^[A-Za-z0-9][A-Za-z0-9 .\/-]{2,49}$/']),
                'legal_form' => $optional(['string', Rule::in(self::LEGAL_FORMS)]),
                'share_capital' => $optional(['integer', 'min:0', 'max:9000000000000']),
                'corporate_purpose' => $optional(['string', 'max:5000']),
                'approval_number' => $optional(['string', 'max:50', 'regex:/^[A-Za-z0-9][A-Za-z0-9 .\/-]{2,49}$/']),
                'approval_expires_at' => $optional(['date_format:Y-m-d']),
                'executives' => ['sometimes', 'array', 'max:10'],
                'executives.*.id' => ['nullable', 'integer'],
                'executives.*.full_name' => ['required', 'string', 'min:2', 'max:150'],
                'executives.*.position' => ['required', 'string', Rule::in(self::EXECUTIVE_POSITIONS)],
                'executives.*.position_label' => ['nullable', 'string', 'max:100'],
                'executives.*.is_visible' => ['sometimes', 'boolean'],
            ];
        }

        return $rules + [
            'phone' => $optional($phone),
            'force_type_id' => $required(['required', 'integer', $visibleExists('state_force_types')]),
            'opening_hours' => $optional(['array', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! self::validOpeningHours($value)) {
                    $fail('Les horaires d\'ouverture sont invalides.');
                }
            }]),
            'is_open_24h' => ['sometimes', 'boolean'],
            'procedure_type_ids' => ['sometimes', 'array', 'max:30'],
            'procedure_type_ids.*' => ['integer', 'distinct', $visibleExists('procedure_types')],
            'procedures' => ['sometimes', 'array', 'max:30'],
            'procedures.*.procedure_type_id' => ['required', 'integer', 'distinct', $visibleExists('procedure_types')],
            'procedures.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Valide la structure des horaires { mon: [["08:00","17:00"], …], … } (liste blanche stricte).
     */
    public static function validOpeningHours(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (! is_array($value) || count($value) > 7) {
            return false;
        }
        foreach ($value as $day => $slots) {
            if (! in_array($day, self::DAYS, true) || ! is_array($slots) || count($slots) > 4) {
                return false;
            }
            foreach ($slots as $slot) {
                if (! is_array($slot) || count($slot) !== 2 || ! array_is_list($slot)) {
                    return false;
                }
                foreach ($slot as $time) {
                    if (! is_string($time) || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time) !== 1) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
