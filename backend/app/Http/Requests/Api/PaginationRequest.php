<?php

namespace App\Http\Requests\Api;

class PaginationRequest extends DirectoryRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
