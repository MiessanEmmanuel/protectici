<?php

namespace App\Http\Requests\Auth;

use App\Rules\ValidTurnstileToken;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class ResendVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'turnstile_token' => ValidTurnstileToken::rules(),
        ];
    }
}
