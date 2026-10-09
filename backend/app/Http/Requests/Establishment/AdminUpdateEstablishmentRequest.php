<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;

/** PATCH administrateur : tous les champs (sensibles inclus) + is_featured (prestataires). */
class AdminUpdateEstablishmentRequest extends EstablishmentRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    public function establishmentType(): ?EstablishmentType
    {
        return EstablishmentType::tryFrom((string) $this->route('type'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->schemaRules(true) + ['is_featured' => ['sometimes', 'boolean']];
    }
}
