<?php

namespace App\Http\Requests\Reviews;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Signalement d'un avis. */
class ReportReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('details'))) {
            $details = PlainText::multiline($this->input('details'));
            $this->merge(['details' => $details === '' ? null : $details]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in(['spam', 'offensive', 'false_info', 'other'])],
            'details' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
