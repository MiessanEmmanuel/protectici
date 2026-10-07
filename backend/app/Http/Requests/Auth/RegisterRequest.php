<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Rules\PhoneNumber;
use App\Rules\StrongPassword;
use App\Rules\ValidTurnstileToken;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

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
            'email' => ['required', 'string', 'email:rfc,strict', 'max:255'],
            'password' => ['required', 'string', 'confirmed', StrongPassword::forRole(User::ROLE_USER)],
            'phone' => ['nullable', 'string', 'max:30', new PhoneNumber],
            'consent' => ['required', 'accepted'],
            'turnstile_token' => ValidTurnstileToken::rules(),
        ];
    }
}
