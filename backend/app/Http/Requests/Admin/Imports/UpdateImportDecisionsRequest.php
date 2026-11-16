<?php

namespace App\Http\Requests\Admin\Imports;

use App\Models\EstablishmentImport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateImportDecisionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', EstablishmentImport::class) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'decisions' => ['required', 'array', 'min:1', 'max:'.(int) config('imports.max_rows', 2000)],
            'decisions.*' => ['required', 'array'],
            'decisions.*.line' => ['required', 'integer', 'min:2', 'max:100000', 'distinct'],
            'decisions.*.decision' => ['required', 'string', Rule::in(['skip', 'create'])],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['decisions' => 'décisions', 'decisions.*.line' => 'ligne', 'decisions.*.decision' => 'décision'];
    }

    /** @return list<array{line: int, decision: string}> */
    public function decisions(): array
    {
        return array_map(fn (array $d) => ['line' => (int) $d['line'], 'decision' => (string) $d['decision']], array_values($this->validated('decisions')));
    }
}
