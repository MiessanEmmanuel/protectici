<?php

namespace App\Http\Requests\Quotes;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Réponse d'un prestataire à une demande de devis : message (10–3000) et montant optionnel en FCFA. */
class ReplyQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('message'))) {
            $this->merge(['message' => PlainText::multiline($this->input('message'))]);
        }
        if ($this->input('quoted_amount') === '') {
            $this->merge(['quoted_amount' => null]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'min:10', 'max:3000'],
            'quoted_amount' => ['nullable', 'integer', 'min:0', 'max:2000000000'],
        ];
    }
}
