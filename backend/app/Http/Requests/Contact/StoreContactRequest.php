<?php

namespace App\Http\Requests\Contact;

use App\Http\Requests\PublicForms\PublicFormRequest;
use App\Support\PlainText;

/** Formulaire de contact (contrat §8.4). */
class StoreContactRequest extends PublicFormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['name', 'subject'] as $field) {
            if (is_string($this->input($field))) {
                $merge[$field] = PlainText::single($this->input($field));
            }
        }
        if (is_string($this->input('message'))) {
            $merge['message'] = PlainText::multiline($this->input('message'));
        }
        if (is_string($this->input('email'))) {
            $merge['email'] = trim($this->input('email'));
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'subject' => ['required', 'string', 'min:2', 'max:200'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
        ] + $this->antispamRules();
    }
}
