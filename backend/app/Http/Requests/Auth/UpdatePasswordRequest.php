<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Rules\StrongPassword;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var User $user */
        $user = $this->user();

        return [
            'current_password' => ['required', 'string', 'max:255', 'current_password:web'],
            // Longueur minimale selon le rôle : 12 (admin/editor/provider), 10 (user).
            'password' => ['required', 'string', 'confirmed', 'different:current_password', StrongPassword::forUser($user)],
        ];
    }
}
