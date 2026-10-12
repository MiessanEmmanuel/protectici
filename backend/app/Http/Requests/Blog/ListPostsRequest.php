<?php

namespace App\Http\Requests\Blog;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Liste publique des articles (contrat §9.1). */
class ListPostsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('q'))) {
            $this->merge(['q' => trim(preg_replace('/\s+/u', ' ', $this->input('q')) ?? '')]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'q' => ['nullable', 'string', 'max:100'],
            'featured' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'string', Rule::in(['recent', 'popular'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ];
    }
}
