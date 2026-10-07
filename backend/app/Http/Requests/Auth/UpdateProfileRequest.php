<?php

namespace App\Http\Requests\Auth;

use App\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

/** Liste blanche : prénom, nom, téléphone. Rôle, email, statut : jamais modifiables ici. */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->can('update', $user);
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => PhoneNumber::normalize($this->input('phone'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL\pM\' .-]{1,100}$/u'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL\pM\' .-]{1,100}$/u'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30', new PhoneNumber],
        ];
    }
}
