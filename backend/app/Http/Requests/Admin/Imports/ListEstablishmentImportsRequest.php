<?php

namespace App\Http\Requests\Admin\Imports;

use App\Enums\EstablishmentType;
use App\Http\Requests\Api\PaginationRequest;
use App\Models\EstablishmentImport;
use Illuminate\Validation\Rule;

class ListEstablishmentImportsRequest extends PaginationRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', EstablishmentImport::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + [
            'type' => ['nullable', 'string', Rule::in(EstablishmentType::values())],
        ];
    }
}
