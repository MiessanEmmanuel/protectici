<?php

namespace App\Http\Requests\Claims;

use App\Http\Requests\Api\PaginationRequest;
use App\Models\EstablishmentClaim;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Liste admin des revendications : `status` (défaut `pending`), pagination bornée. */
class ListClaimsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('viewAny', EstablishmentClaim::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in(EstablishmentClaim::STATUSES)],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function perPage(): int
    {
        return max(1, min(PaginationRequest::MAX_PER_PAGE, (int) ($this->validated('per_page') ?? PaginationRequest::DEFAULT_PER_PAGE)));
    }
}
