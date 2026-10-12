<?php

namespace App\Http\Requests\Content;

use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

class UploadContentMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('alt'))) {
            $this->merge(['alt' => PlainText::single($this->input('alt'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.config('establishments.media.max_kb')],
            'alt' => ['required', 'string', 'min:2', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return ['file' => 'fichier', 'alt' => 'texte alternatif'];
    }
}
