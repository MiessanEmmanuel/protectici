<?php

namespace App\Http\Requests\Quotes;

use App\Http\Requests\Concerns\RejectsMarkup;
use App\Http\Requests\Quotes\Concerns\AuthorizesQuoteRecipient;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Refus d'un prestataire : motif facultatif (500 caractères). */
class DeclineQuoteRequest extends FormRequest
{
    use AuthorizesQuoteRecipient;
    use RejectsMarkup;

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $reason = PlainText::single($this->input('reason'));
            $this->merge(['reason' => $reason === '' ? null : $reason]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['reason' => ['nullable', 'string', 'max:500']];
    }
}
