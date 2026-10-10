<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UpdateFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('admin-area');
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'required', 'string', Rule::in(['new', 'in_progress', 'forwarded', 'resolved', 'closed'])],
            'assigned_to' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->where('role', User::ROLE_ADMIN)->where('is_active', true)->whereNull('deleted_at')],
        ];
    }

    /** @return array<string, mixed> */
    public function validationData(): array
    {
        return $this->all();
    }

    protected function passedValidation(): void
    {
        if (! $this->has('status') && ! $this->has('assigned_to')) {
            throw ValidationException::withMessages(['status' => ['Aucune modification fournie.']]);
        }
    }
}
