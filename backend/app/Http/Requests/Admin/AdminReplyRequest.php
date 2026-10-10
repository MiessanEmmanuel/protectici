<?php

namespace App\Http\Requests\Admin;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

/** Réponse de l'administration (dossier « Dis-moi tout » ou message de contact). `is_internal` seulement pour le dossier. */
class AdminReplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
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
        $rules = ['body' => ['required', 'string', 'min:5', 'max:5000']];
        if ($this->routeIs('admin.feedbacks.reply')) {
            $rules['is_internal'] = ['required', 'boolean'];
        }

        return $rules;
    }
}
