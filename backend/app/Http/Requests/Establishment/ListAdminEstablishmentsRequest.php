<?php

namespace App\Http\Requests\Establishment;

use App\Enums\EstablishmentType;
use App\Http\Requests\Api\PaginationRequest;
use Illuminate\Validation\Rule;

class ListAdminEstablishmentsRequest extends PaginationRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + [
            'type' => ['nullable', 'string', Rule::in(EstablishmentType::values())],
            'status' => ['nullable', 'string', Rule::in(['draft', 'pending', 'approved', 'rejected', 'suspended'])],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', Rule::in(['-submitted_at', 'name'])],
        ];
    }
}
