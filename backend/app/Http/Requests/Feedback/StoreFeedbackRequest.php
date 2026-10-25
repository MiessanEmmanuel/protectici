<?php

namespace App\Http\Requests\Feedback;

use App\Http\Requests\PublicForms\PublicFormRequest;
use App\Models\FeedbackTopic;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Rules\PhoneNumber;
use App\Services\Feedback\VoiceNoteStore;
use App\Support\PlainText;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

/**
 * « Dis-moi tout » (contrat §8.2, §8.2 bis). Liste blanche ; topic requis sauf produit, service_type requis si service ;
 * commentaire écrit OU message vocal (multipart `voice` + `voice_duration_seconds`), les deux acceptés ensemble.
 * Le type réel du vocal est vérifié par signature dans VoiceNoteStore (pas ici : `mimes` se fie à l'extension).
 */
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
            'comment' => ['required_without:voice', 'nullable', 'string', 'min:10', 'max:3000'],
            'voice' => ['nullable', 'file', 'max:'.(int) config('feedback.voice_max_kb', 5120)],
            'voice_duration_seconds' => ['required_with:voice', 'nullable', 'integer', 'between:1,'.(int) config('feedback.voice_max_duration_seconds', 120)],
        ] + $this->antispamRules();
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'topic_id.required' => 'Veuillez choisir un sujet.',
            'service_type_id.required' => 'Veuillez choisir le type de prestation.',
            'provider_slug.exists' => 'Le prestataire sélectionné est introuvable.',
            'comment.required_without' => 'Écrivez un commentaire ou enregistrez un message vocal.',
            'voice.file' => VoiceNoteStore::INVALID,
            'voice.uploaded' => VoiceNoteStore::INVALID,
            'voice.max' => VoiceNoteStore::INVALID,
        ];
    }

    /** Fichier vocal transmis, le cas échéant. */
    public function voice(): ?UploadedFile
    {
        $file = $this->file('voice');

        return $file instanceof UploadedFile ? $file : null;
    }

    /**
     * Base du hachage d'idempotence : le fichier n'est pas sérialisable, il est remplacé par son empreinte
     * (taille + SHA-256) ; la durée n'est retenue qu'avec un vocal.
     *
     * @return array<string, mixed>
     */
    public function formData(): array
    {
        $data = parent::formData();
        unset($data['voice']);

        $voice = $this->voice();
        if ($voice === null) {
            unset($data['voice_duration_seconds']);

            return $data;
        }

        $path = $voice->getRealPath();
        $data['voice_fingerprint'] = [
            'size' => (int) $voice->getSize(),
            'sha256' => $path === false ? '' : (string) hash_file('sha256', $path),
        ];

        return $data;
    }
}
