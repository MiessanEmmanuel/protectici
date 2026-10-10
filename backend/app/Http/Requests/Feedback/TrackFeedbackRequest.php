<?php

namespace App\Http\Requests\Feedback;

use Illuminate\Foundation\Http\FormRequest;

/** Suivi d'un dossier : référence ET e-mail, toujours en POST (jamais dans l'URL). */
class TrackFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('reference'))) {
            $merge['reference'] = mb_strtoupper(trim($this->input('reference')));
        }
        if (is_string($this->input('email'))) {
            $merge['email'] = trim($this->input('email'));
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reference' => ['required', 'string', 'regex:/^DMT-\d{4}-\d{6}$/'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['reference.regex' => 'Le numéro de suivi est invalide (format attendu : DMT-2026-000123).'];
    }
}
