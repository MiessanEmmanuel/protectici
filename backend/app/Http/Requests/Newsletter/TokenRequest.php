<?php

namespace App\Http\Requests\Newsletter;

use Illuminate\Foundation\Http\FormRequest;

/** Jeton signé d'un lien de newsletter (confirmation ou désinscription). */
class TokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['token' => ['required', 'string', 'max:200', 'regex:/^[A-Za-z0-9._-]+$/']];
    }
}
