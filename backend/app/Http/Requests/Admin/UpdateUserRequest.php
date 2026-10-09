<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Liste blanche : seuls `role` et `is_active` sont lus ; tout autre champ est ignoré. */
class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'role' => ['sometimes', 'string', Rule::in(User::ROLES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'role.in' => 'Le rôle choisi n\'est pas valide.',
            'is_active.boolean' => 'Le statut du compte n\'est pas valide.',
        ];
    }

    /** @return array<int, \Closure> */
    public function after(): array
    {
        return [function ($validator) {
            if (! $this->has('role') && ! $this->has('is_active')) {
                $validator->errors()->add('role', 'Indiquez le rôle ou le statut à modifier.');
            }
        }];
    }

    /** @return array{role?: string, is_active?: bool} */
    public function changes(): array
    {
        $data = [];
        if ($this->has('role')) {
            $data['role'] = (string) $this->input('role');
        }
        if ($this->has('is_active')) {
            $data['is_active'] = $this->boolean('is_active');
        }

        return $data;
    }
}
