<?php

namespace App\Services\Contact;

use App\Exceptions\ApiHttpException;
use App\Models\ContactMessage;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Contact\ContactMail;
use App\Services\AuditLogger;
use App\Services\Notifications\SafeNotifier;
use App\Services\PublicForms\FormSubmission;
use Illuminate\Support\Facades\DB;

/** Formulaire de contact : création publique, traitement et réponse par l'administration. */
class ContactService
{
    public const MESSAGE = 'Merci, votre message a bien été envoyé.';

    public function __construct(
        private readonly FormSubmission $submission,
        private readonly SafeNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: ContactMessage, 1: bool}
     */
    public function create(?User $user, array $data, ?string $idempotencyKey, string $ip): array
    {
        /** @var array{0: ContactMessage, 1: bool} $result */
        $result = $this->submission->handle(
            'contact', 'contact_message', $user, $data, (string) ($data['email'] ?? ''), $idempotencyKey, $ip,
            function (?string $ipHash) use ($data): ContactMessage {
                $message = (new ContactMessage)->fill(array_intersect_key($data, array_flip(['name', 'email', 'subject', 'message'])));
                $message->forceFill(['consent_at' => now(), 'ip_hash' => $ipHash])->save();

                return $message;
            },
        );

        [$message, $created] = $result;
        if ($created) {
            $this->notifier->toAddress($message->email, new ContactMail(ContactMail::RECEIVED, $message->name, $message->subject), 'contact_received');
            $this->notifier->admins(new AdminAlert(
                AdminAlert::KIND_CONTACT_RECEIVED,
                'Nouveau message de contact',
                'Un nouveau message a été reçu via le formulaire de contact.',
                null,
                ['type' => 'contact_message', 'id' => $message->id],
            ));
        }

        return $result;
    }

    public function updateStatus(ContactMessage $message, string $status, User $admin): ContactMessage
    {
        return DB::transaction(function () use ($message, $status, $admin) {
            $locked = ContactMessage::query()->whereKey($message->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === $status) {
                return $locked; // idempotent
            }
            $old = $locked->status;
            $locked->status = $status;
            if ($status !== 'new') {
                $locked->forceFill(['handled_by' => $admin->id, 'handled_at' => now()]);
            }
            $locked->save();
            $this->audit->record('contact_message_status_changed', $locked, ['status' => $old], ['status' => $status]);

            return $locked;
        });
    }

    /** Réponse par e-mail, UNE seule fois (statut `answered` ensuite). */
    public function reply(ContactMessage $message, User $admin, string $body): ContactMessage
    {
        $locked = DB::transaction(function () use ($message, $admin) {
            $locked = ContactMessage::query()->whereKey($message->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'answered') {
                throw new ApiHttpException(409, 'Ce message a déjà reçu une réponse.');
            }
            if ($locked->email === null || $locked->email === '') {
                throw new ApiHttpException(409, 'Ce message est anonymisé : aucune réponse ne peut être envoyée.');
            }
            $locked->status = 'answered';
            $locked->forceFill(['handled_by' => $admin->id, 'handled_at' => now()])->save();
            $this->audit->record('contact_message_replied', $locked);

            return $locked;
        });

        $this->notifier->toAddress($locked->email, new ContactMail(ContactMail::REPLY, $locked->name, $locked->subject, $body), 'contact_reply');

        return $locked;
    }
}
