<?php

namespace App\Http\Requests\Reviews;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Réponse unique du prestataire à un avis. */
class ReplyReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => PlainText::multiline($this->input('body'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['body' => ['required', 'string', 'min:5', 'max:1500']];
    }
}
