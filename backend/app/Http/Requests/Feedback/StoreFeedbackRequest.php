<?php

namespace App\Http\Requests\Feedback;

use App\Http\Requests\PublicForms\PublicFormRequest;
use App\Models\FeedbackTopic;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Rules\PhoneNumber;
use App\Support\PlainText;
use Illuminate\Validation\Rule;

/** « Dis-moi tout » (contrat §8.2). Liste blanche ; topic requis sauf produit, service_type requis si service. */
class StoreFeedbackRequest extends PublicFormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['last_name', 'first_name', 'product_type', 'location', 'civility'] as $field) {
            if (is_string($this->input($field))) {
                $merge[$field] = PlainText::single($this->input($field));
            }
        }
        if (is_string($this->input('comment'))) {
            $merge['comment'] = PlainText::multiline($this->input('comment'));
        }
        if (is_string($this->input('email'))) {
            $merge['email'] = trim($this->input('email'));
        }
        if ($this->has('phone')) {
            $merge['phone'] = PhoneNumber::normalize($this->input('phone'));
        }
        // Les chaînes vides des champs facultatifs deviennent null.
        foreach (['civility', 'provider_slug', 'product_type', 'location', 'service_type_id', 'topic_id'] as $field) {
            if ($this->input($field) === '') {
                $merge[$field] = null;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $target = $this->input('target_type');

        return [
            'civility' => ['nullable', 'string', Rule::in(['M.', 'Mme', 'Mlle'])],
            'last_name' => ['required', 'string', 'min:2', 'max:100'],
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'phone' => ['nullable', 'string', new PhoneNumber],
            'provider_slug' => ['nullable', 'string', 'max:200', Rule::exists((new Provider)->getTable(), 'slug')
                ->where('is_visible', true)->where('status', 'approved')->whereNull('deleted_at')],
            'action_type' => ['required', 'string', Rule::in(['encouragement', 'question', 'complaint', 'suggestion'])],
            'target_type' => ['required', 'string', Rule::in(['employee', 'product', 'service'])],
            'service_type_id' => [$target === 'service' ? 'required' : 'nullable', 'integer', Rule::exists((new ServiceType)->getTable(), 'id')->where('is_visible', true)],
            'topic_id' => [$target === 'product' ? 'nullable' : 'required', 'integer', Rule::exists((new FeedbackTopic)->getTable(), 'id')->where('is_visible', true)],
            'product_type' => ['nullable', 'string', 'max:150'],
            'location' => ['nullable', 'string', 'max:255'],
            'comment' => ['required', 'string', 'min:10', 'max:3000'],
        ] + $this->antispamRules();
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'topic_id.required' => 'Veuillez choisir un sujet.',
            'service_type_id.required' => 'Veuillez choisir le type de prestation.',
            'provider_slug.exists' => 'Le prestataire sélectionné est introuvable.',
        ];
    }
}
