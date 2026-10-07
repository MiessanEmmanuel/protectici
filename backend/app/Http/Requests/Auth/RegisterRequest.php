<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Rules\PhoneNumber;
use App\Rules\StrongPassword;
use App\Rules\ValidTurnstileToken;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $normalized = [];
        if (is_string($this->input('email'))) {
            $normalized['email'] = Str::lower(trim($this->input('email')));
        }
        if ($this->has('phone')) {
            $normalized['phone'] = PhoneNumber::normalize($this->input('phone'));
        }
        $this->merge($normalized);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[\pL\pM\' .-]{1,100}$/u'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[\pL\pM\' .-]{1,100}$/u'],
            'email' => ['required', 'string', 'email:rfc,strict', 'max:255', Rule::unique('users', 'email')->withoutTrashed()],
            'password' => ['required', 'string', 'confirmed', StrongPassword::forRole(User::ROLE_USER)],
            'phone' => ['nullable', 'string', 'max:30', new PhoneNumber],
            'consent' => ['required', 'accepted'],
            'turnstile_token' => ValidTurnstileToken::rules(),
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            // Anti-énumération : pas de « cette adresse est déjà utilisée ».
            'email.unique' => __('auth.register_failed'),
        ];
    }
}
