<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;
use App\Http\Requests\Establishment\Concerns\RequiresOwnedEstablishment;
use App\Support\Establishments\EstablishmentSchema;
use App\Support\PlainText;

/** Demande de modification : uniquement les champs SENSIBLES du type d'établissement. */
class ChangeRequestRequest extends EstablishmentRequest
{
    use RequiresOwnedEstablishment;

    public function establishmentType(): ?EstablishmentType
    {
        return EstablishmentType::tryFrom((string) $this->route('type'));
    }

    protected function prepareForValidation(): void
    {
        $changes = $this->input('changes');
        if (! is_array($changes)) {
            return;
        }
        foreach (['name', 'rccm', 'approval_number'] as $f) {
            if (isset($changes[$f]) && is_string($changes[$f])) {
                $changes[$f] = PlainText::single($changes[$f]);
            }
        }
        if (isset($changes['corporate_purpose']) && is_string($changes['corporate_purpose'])) {
            $changes['corporate_purpose'] = PlainText::multiline($changes['corporate_purpose']);
        }
        $this->merge(['changes' => $changes]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $type = $this->establishmentType() ?? EstablishmentType::Provider;
        $sensitive = EstablishmentSchema::sensitive($type);
        $schema = EstablishmentSchema::rules($type, true);

        $rules = ['changes' => ['required', 'array', 'min:1']];
        // Tout champ non sensible (ou inconnu) est refusé : « Ce champ nécessite… » ne s'applique qu'aux sensibles.
        $rules['changes.*'] = [function (string $attribute, mixed $value, \Closure $fail) use ($sensitive): void {
            $field = substr($attribute, strlen('changes.'));
            if (! in_array($field, $sensitive, true)) {
                $fail('Ce champ ne peut pas faire l\'objet d\'une demande de modification.');
            }
        }];
        foreach ($sensitive as $field) {
            $rules["changes.{$field}"] = array_values(array_filter(
                $schema[$field] ?? ['string'],
                fn ($r) => $r !== 'sometimes',
            ));
            array_unshift($rules["changes.{$field}"], 'required');
            $rules["changes.{$field}"] = array_values(array_filter($rules["changes.{$field}"], fn ($r) => $r !== 'nullable'));
            array_unshift($rules["changes.{$field}"], 'sometimes');
        }

        return $rules;
    }
}
