<?php

namespace App\Http\Requests\Newsletter;

use App\Http\Requests\PublicForms\PublicFormRequest;
use Illuminate\Validation\Rule;

/** Inscription à la lettre d'information (contrat §9.1) : antispam §8.0 + consentement obligatoire. */
class SubscribeRequest extends PublicFormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'source' => ['nullable', 'string', Rule::in(['footer', 'blog', 'register', 'home', 'other'])],
        ] + $this->antispamRules();
    }
}
