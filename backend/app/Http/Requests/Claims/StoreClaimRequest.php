<?php

namespace App\Http\Requests\Claims;

use App\Http\Requests\Concerns\RejectsMarkup;
use App\Rules\PhoneNumber;
use App\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Revendication d'une fiche (contrat §10.3). Liste blanche : qualité, téléphone, message, justificatif, consentement.
 * Le type RÉEL du justificatif est revérifié par contenu dans DocumentManager::inspect (PDF sans contenu actif,
 * images réencodées) ; la règle `mimes` n'est qu'un premier filtre.
 */
class StoreClaimRequest extends FormRequest
{
    use RejectsMarkup;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $clean = [];
        if ($this->has('phone')) {
            $clean['phone'] = PhoneNumber::normalize($this->input('phone'));
        }
        if (is_string($this->input('message'))) {
            $message = PlainText::multiline($this->input('message'));
            $clean['message'] = $message === '' ? null : $message;
        }
        $this->merge($clean);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'submitter_role' => ['required', 'string', Rule::in(['manager', 'employee', 'other'])],
            'phone' => ['required', 'string', new PhoneNumber],
            'message' => ['nullable', 'string', 'max:1000'],
            'document' => ['required', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png'],
            'consent' => ['required', 'accepted'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'submitter_role.required' => 'Veuillez indiquer votre qualité.',
            'submitter_role.in' => 'La qualité choisie est invalide.',
            'phone.required' => 'Veuillez indiquer un numéro de téléphone.',
            'message.max' => 'Le message ne peut pas dépasser 1000 caractères.',
            'document.required' => 'Veuillez joindre un justificatif.',
            'document.file' => 'Le justificatif n\'a pas pu être envoyé correctement.',
            'document.max' => 'Le justificatif ne doit pas dépasser 5 Mo.',
            'document.mimes' => 'Seuls les fichiers PDF, JPEG et PNG sont acceptés.',
            'consent.required' => 'Veuillez accepter le traitement de vos données.',
            'consent.accepted' => 'Veuillez accepter le traitement de vos données.',
        ];
    }
}
