<?php

namespace App\Http\Requests\PublicForms;

use App\Rules\PhoneNumber;
use App\Support\PlainText;
use Illuminate\Validation\Rule;

/**
 * Demande de devis publique (contrat §8.3) : liste blanche de champs, texte nettoyé, téléphone normalisé (E.164),
 * prestataires ciblés = fiches PUBLIÉES uniquement.
 */
class StoreQuoteRequest extends PublicFormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['first_name', 'last_name', 'company_name', 'budget_range'] as $field) {
            if (is_string($this->input($field))) {
                $merge[$field] = PlainText::single($this->input($field));
            }
        }
        if (is_string($this->input('description'))) {
            $merge['description'] = PlainText::multiline($this->input('description'));
        }
        if (is_string($this->input('email'))) {
            $merge['email'] = mb_strtolower(trim($this->input('email')));
        }
        if ($this->has('phone')) {
            $merge['phone'] = PhoneNumber::normalize($this->input('phone'));
        }
        foreach (['company_name', 'budget_range', 'desired_start_date', 'district_id'] as $optional) {
            if ($this->has($optional) && $this->input($optional) === '') {
                $merge[$optional] = null;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'phone' => ['required', 'string', new PhoneNumber],
            'company_name' => ['nullable', 'string', 'max:200'],
            'service_type_id' => ['required', 'integer', Rule::exists('service_types', 'id')->where('is_visible', true)],
            'city_id' => ['required', 'integer', Rule::exists('cities', 'id')->where('is_visible', true)],
            'district_id' => ['nullable', 'integer', Rule::exists('districts', 'id')->where('city_id', $this->input('city_id'))->where('is_visible', true)],
            'description' => ['required', 'string', 'min:20', 'max:3000'],
            'desired_start_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
            'budget_range' => ['nullable', 'string', 'max:50'],
            'provider_slugs' => ['nullable', 'array', 'max:5'],
            'provider_slugs.*' => [
                'string', 'max:200', 'distinct',
                Rule::exists('providers', 'slug')->where('is_visible', true)->where('status', 'approved')->whereNull('deleted_at'),
            ],
        ] + $this->antispamRules();
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'provider_slugs.*.exists' => 'Un des prestataires sélectionnés n\'est pas disponible.',
            'provider_slugs.max' => 'Vous pouvez solliciter au plus 5 prestataires.',
            'district_id.exists' => 'Le quartier choisi ne correspond pas à la ville.',
            'description.min' => 'Décrivez votre besoin en au moins 20 caractères.',
            'desired_start_date.after_or_equal' => 'La date souhaitée ne peut pas être dans le passé.',
        ];
    }
}
