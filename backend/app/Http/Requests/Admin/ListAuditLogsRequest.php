<?php

namespace App\Http\Requests\Admin;

use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListAuditLogsRequest extends FormRequest
{
    private const DATE = '/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/';

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'event' => ['sometimes', 'nullable', 'string', 'max:100', 'regex:/^[a-z0-9_.:-]+$/i'],
            'user_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            // Liste blanche = clés du morph map (jamais de nom de classe).
            'auditable_type' => ['sometimes', 'nullable', 'string', Rule::in(array_keys(Relation::morphMap()))],
            'from' => ['sometimes', 'nullable', 'string', 'regex:'.self::DATE, 'date'],
            'to' => ['sometimes', 'nullable', 'string', 'regex:'.self::DATE, 'date', 'after_or_equal:from'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'event.regex' => 'Le nom d\'événement n\'est pas valide.',
            'auditable_type.in' => 'Le type d\'objet n\'est pas valide.',
            'from.regex' => 'La date de début n\'est pas valide.',
            'to.regex' => 'La date de fin n\'est pas valide.',
            'to.after_or_equal' => 'La date de fin doit suivre la date de début.',
        ];
    }
}
