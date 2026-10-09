<?php

namespace App\Http\Requests\Establishment;

use App\Http\Requests\Establishment\Concerns\RequiresOwnedEstablishment;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadMediaRequest extends FormRequest
{
    use RequiresOwnedEstablishment;

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
            'collection' => ['required', 'string', Rule::in(['logo', 'cover', 'gallery'])],
            'alt' => ['required', 'string', 'min:2', 'max:255'],
        ];
    }
}
