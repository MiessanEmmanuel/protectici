<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'role' => ['sometimes', 'nullable', Rule::in(User::ROLES)],
            'is_active' => ['sometimes', 'nullable', Rule::in(['0', '1', 'true', 'false', 0, 1, true, false])],
            'sort' => ['sometimes', 'nullable', Rule::in(['created_at', '-created_at', 'last_name', '-last_name'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    /** @return array{q: ?string, role: ?string, is_active: ?bool, sort: ?string, per_page: int} */
    public function filters(): array
    {
        $isActive = $this->input('is_active');

        return [
            'q' => $this->filled('q') ? (string) $this->input('q') : null,
            'role' => $this->filled('role') ? (string) $this->input('role') : null,
            'is_active' => $isActive === null || $isActive === '' ? null : filter_var($isActive, FILTER_VALIDATE_BOOLEAN),
            'sort' => $this->filled('sort') ? (string) $this->input('sort') : null,
            'per_page' => (int) $this->input('per_page', 12),
        ];
    }
}
