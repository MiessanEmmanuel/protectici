<?php

namespace App\Http\Requests\Establishment;

use Illuminate\Foundation\Http\FormRequest;

class DeleteEstablishmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['confirm_name' => ['required', 'string', 'max:200']];
    }
}
