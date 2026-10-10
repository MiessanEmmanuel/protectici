<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListFeedbacksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in(['new', 'in_progress', 'forwarded', 'resolved', 'closed'])],
            'action_type' => ['nullable', 'string', Rule::in(['encouragement', 'question', 'complaint', 'suggestion'])],
            'provider' => ['nullable', 'string', 'max:200'],
            'assigned_to' => ['nullable', 'integer', 'min:1'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', Rule::in(['-created_at', 'created_at', 'status'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
