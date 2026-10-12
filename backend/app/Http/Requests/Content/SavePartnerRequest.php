<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SavePartnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'type' => [$required, 'string', Rule::in(['partner', 'client'])],
            'name' => [$required, 'string', 'min:2', 'max:150'],
            'website_url' => ['sometimes', 'nullable', 'string', 'max:255', 'url:http,https'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:32000'],
            'is_visible' => ['sometimes', 'boolean'],
            'logo_media_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['type' => 'type', 'name' => 'nom', 'website_url' => 'site web', 'sort_order' => 'ordre', 'is_visible' => 'visibilité', 'logo_media_id' => 'logo'];
    }
}
