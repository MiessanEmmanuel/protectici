<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;
use App\Http\Requests\Establishment\Concerns\RequiresOwnedEstablishment;

/** PATCH propriétaire : liste blanche complète en « sometimes » ; le refus des champs sensibles est fait par le service. */
class UpdateEstablishmentRequest extends EstablishmentRequest
{
    use RequiresOwnedEstablishment;

    public function establishmentType(): ?EstablishmentType
    {
        return EstablishmentType::tryFrom((string) $this->route('type'));
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->schemaRules(true);
    }
}
