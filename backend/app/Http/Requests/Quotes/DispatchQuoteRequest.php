<?php

namespace App\Http\Requests\Quotes;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Acheminement par l'administration : 1 à 5 fiches PUBLIÉES. */
class DispatchQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'provider_ids' => ['required', 'array', 'min:1', 'max:5'],
            'provider_ids.*' => [
                'integer', 'distinct',
                Rule::exists('providers', 'id')->where('is_visible', true)->where('status', 'approved')->whereNull('deleted_at'),
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['provider_ids.*.exists' => 'Un des prestataires sélectionnés n\'est pas publié.'];
    }
}
