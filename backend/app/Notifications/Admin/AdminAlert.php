<?php

namespace App\Notifications\Admin;

use Illuminate\Notifications\Notification;

/**
 * Notification interne (base de données) destinée aux administrateurs : nouvelle fiche, demande de modification,
 * nouveau justificatif. Ne contient jamais de donnée personnelle superflue (ni e-mail, ni téléphone, ni pièce).
 */
class AdminAlert extends Notification
{
    public const KIND_ESTABLISHMENT_SUBMITTED = 'establishment_submitted';

    public const KIND_CHANGE_REQUEST_SUBMITTED = 'change_request_submitted';

    public const KIND_DOCUMENT_UPLOADED = 'document_uploaded';

    public const KIND_REVIEW_SUBMITTED = 'review_submitted';

    public const KIND_REVIEW_REPORTED = 'review_reported';

    public const KIND_FEEDBACK_RECEIVED = 'feedback_received';

    public const KIND_QUOTE_REQUESTED = 'quote_requested';

    public const KIND_CONTACT_RECEIVED = 'contact_received';

    /**
     * @param  array{type?: string, id?: int, slug?: string, name?: string}|null  $establishment
     * @param  array{type: string, id: int, reference?: string}|null  $subject  objet concerné (avis, dossier, devis, message) : identifiants uniquement, jamais de donnée personnelle
     */
    public function __construct(
        public readonly string $kind,
        public readonly string $title,
        public readonly string $message,
        public readonly ?array $establishment = null,
        public readonly ?array $subject = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'message' => $this->message,
            'establishment' => $this->establishment,
            'subject' => $this->subject,
        ];
    }
}
