<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ModerateCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['status' => ['required', 'string', Rule::in(['approved', 'rejected', 'spam'])]];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['status' => 'statut'];
    }
}
