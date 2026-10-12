<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Liste des articles du back-office (tous statuts). */
class ListPostsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Autorisation portée par le groupe de routes (Gate content-area) et le contrôleur.
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in(['draft', 'scheduled', 'published', 'archived'])],
            'category' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
