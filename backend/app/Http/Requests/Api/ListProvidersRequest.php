<?php

namespace App\Http\Requests\Api;

use Illuminate\Validation\Rule;

class ListProvidersRequest extends DirectoryRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->commonRules() + [
            'filter.service' => $this->slugListRule(),
            'filter.company_type' => $this->slugListRule(),
            'sort' => ['nullable', 'string', Rule::in(['name', '-rating', '-popular', 'distance'])],
        ];
    }
}
