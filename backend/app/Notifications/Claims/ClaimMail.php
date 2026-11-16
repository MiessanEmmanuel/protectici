<?php

namespace App\Notifications\Claims;

use App\Enums\EstablishmentType;
use App\Models\User;
use App\Support\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mails de revendication de fiche (contrat §10.3), envoyés uniquement au compte demandeur : demande reçue,
 * acceptée (également utilisé pour l'attribution par l'administration), refusée avec motif. Ne contient que le nom
 * de la fiche et, le cas échéant, le motif : ni téléphone, ni justificatif. Mis en file (driver database).
 */
class ClaimMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public const RECEIVED = 'received';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public int $tries = 3;

    public function __construct(
        public readonly string $event,
        public readonly string $name,
        public readonly EstablishmentType $type,
        public readonly string $slug,
        public readonly ?string $reason = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');
        $space = $front.'/espace-prestataire/'.$this->type->value.'/'.$this->slug;
        $name = MailText::plain($this->name);

        $mail = (new MailMessage)->greeting('Bonjour '.MailText::plain((string) $notifiable->first_name).',');

        if ($this->event === self::RECEIVED) {
            $mail->subject('Votre demande de revendication a bien été reçue - ProtectIci')
                ->line('Nous avons bien reçu votre demande de revendication de la fiche « '.$name.' ».')
                ->line('Notre équipe va vérifier votre justificatif. Vous serez informé(e) par e-mail dès qu\'une décision sera prise.')
                ->action('Suivre mes demandes', $front.'/espace-prestataire');
        } elseif ($this->event === self::APPROVED) {
            $mail->subject('Vous gérez désormais la fiche « '.$this->name.' » - ProtectIci')
                ->line('La fiche « '.$name.' » est désormais rattachée à votre compte.')
                ->line('Vous pouvez la compléter et la mettre à jour depuis votre espace établissement. Les informations légales se modifient par une demande validée par notre équipe.')
                ->action('Ouvrir mon espace établissement', $space);
        } else {
            $mail->subject('Votre demande de revendication n\'a pas été acceptée - ProtectIci')
                ->line('Votre demande de revendication de la fiche « '.$name.' » n\'a pas été acceptée.');
            foreach (MailText::lines('Motif : '.(string) $this->reason) as $line) {
                $mail->line($line);
            }
            $mail->line('Pour toute question, contactez l\'équipe ProtectIci.');
        }

        return $mail->salutation('L\'équipe ProtectIci');
    }
}
