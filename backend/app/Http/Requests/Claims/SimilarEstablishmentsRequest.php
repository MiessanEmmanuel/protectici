<?php

namespace App\Http\Requests\Claims;

use App\Enums\EstablishmentType;
use App\Rules\PhoneNumber;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Recherche anti-doublon à l'inscription (contrat §10.3) : type, nom (≥ 3), ville et téléphone facultatifs. */
class SimilarEstablishmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        if (is_string($this->input('name'))) {
            $clean['name'] = PlainText::single($this->input('name'));
        }
        if (is_string($this->input('phone'))) {
            $clean['phone'] = PhoneNumber::normalize($this->input('phone'));
        }
        $this->merge($clean);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(EstablishmentType::values())],
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'city_id' => ['nullable', 'integer', 'min:1'],
            'phone' => ['nullable', 'string', new PhoneNumber],
        ];
    }
}
