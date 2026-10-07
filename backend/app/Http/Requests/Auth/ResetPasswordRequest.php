<?php

namespace App\Http\Requests\Auth;

use App\Rules\StrongPassword;
use Illuminate\Foundation\Http\FormRequest;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            // Socle commun (10). La règle du rôle (12 pour provider/editor/admin) est appliquée par le
            // service APRÈS validation du jeton : aucune information sur le compte sans jeton valide.
            'password' => ['required', 'string', 'confirmed', StrongPassword::make(StrongPassword::MIN_USER)],
        ];
    }
}
