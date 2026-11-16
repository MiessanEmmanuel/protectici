<?php

namespace App\Http\Requests\Admin\Imports;

use App\Http\Requests\Api\PaginationRequest;
use App\Models\EstablishmentImport;
use Illuminate\Validation\Rule;

class ListImportRowsRequest extends PaginationRequest
{
    public const MAX_PER_PAGE = 100;

    public const DEFAULT_PER_PAGE = 50;

    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', EstablishmentImport::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + [
            'filter' => ['sometimes', 'array'],
            'filter.status' => ['nullable', 'string', Rule::in(['valid', 'invalid', 'duplicate'])],
        ];
    }

    public function perPage(): int
    {
        return max(1, min(self::MAX_PER_PAGE, (int) ($this->validated('per_page') ?? self::DEFAULT_PER_PAGE)));
    }

    public function status(): ?string
    {
        $status = $this->validated('filter.status');

        return is_string($status) ? $status : null;
    }
}
