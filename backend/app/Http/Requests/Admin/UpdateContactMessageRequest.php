<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateContactMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['status' => ['required', 'string', Rule::in(['new', 'read', 'answered', 'archived'])]];
    }
}
