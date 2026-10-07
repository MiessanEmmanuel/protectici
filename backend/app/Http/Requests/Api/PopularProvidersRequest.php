<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class PopularProvidersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['limit' => ['nullable', 'integer', 'min:1', 'max:20']];
    }

    public function limit(): int
    {
        return (int) ($this->validated('limit') ?? 8);
    }
}
