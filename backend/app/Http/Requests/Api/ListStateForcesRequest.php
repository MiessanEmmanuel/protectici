<?php

namespace App\Http\Requests\Api;

use Illuminate\Validation\Rule;

class ListStateForcesRequest extends DirectoryRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->commonRules() + [
            'filter.type' => $this->slugListRule(),
            'filter.procedure' => $this->slugListRule(),
            'sort' => ['nullable', 'string', Rule::in(['name', 'distance'])],
        ];
    }
}
