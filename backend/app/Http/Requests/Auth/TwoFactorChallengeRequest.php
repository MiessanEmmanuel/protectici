<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class TwoFactorChallengeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'code' => ['nullable', 'required_without:recovery_code', 'prohibits:recovery_code', 'string', 'regex:/^\d{6}$/'],
            'recovery_code' => ['nullable', 'required_without:code', 'string', 'max:32'],
        ];
    }
}
