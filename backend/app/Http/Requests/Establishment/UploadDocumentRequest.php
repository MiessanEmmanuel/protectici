<?php

namespace App\Http\Requests\Establishment;

use App\Http\Requests\Establishment\Concerns\RequiresOwnedEstablishment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadDocumentRequest extends FormRequest
{
    use RequiresOwnedEstablishment;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.config('establishments.documents.max_kb')],
            'type' => ['required', 'string', Rule::in(['approval_certificate', 'rccm_extract', 'id_document', 'other'])],
        ];
    }
}
