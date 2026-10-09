<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AnonymizeUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['confirm_email' => ['required', 'string', 'max:255']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['confirm_email.required' => 'Saisissez l\'adresse e-mail du compte pour confirmer.'];
    }
}
