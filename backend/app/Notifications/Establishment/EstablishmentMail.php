<?php

namespace App\Notifications\Establishment;

use App\Enums\EstablishmentType;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mails du workflow d'établissement (contrat §7.4), en français, envoyés uniquement au propriétaire de la fiche.
 * Ne contient que le nom de la fiche, le statut et, le cas échéant, le motif saisi par l'administration : aucune
 * donnée légale ni coordonnée. Les liens pointent vers le site (pas de lien signé).
 */
class EstablishmentMail extends Notification
{
    public const RECEIVED = 'received';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const SUSPENDED = 'suspended';

    public const CHANGE_APPROVED = 'change_approved';

    public const CHANGE_REJECTED = 'change_rejected';

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
        $public = $front.($this->type === EstablishmentType::Provider ? '/annuaire/' : '/forces-etatiques/').$this->slug;

        $mail = (new MailMessage)->greeting('Bonjour '.$notifiable->first_name.',');

        match ($this->event) {
            self::RECEIVED => $mail
                ->subject('Votre fiche a bien été reçue - ProtectIci')
                ->line('Nous avons bien reçu la fiche « '.$this->name.' ».')
                ->line('Elle est en cours de vérification par notre équipe. Vous serez informé(e) par e-mail dès qu\'une décision sera prise.')
                ->action('Suivre ma fiche', $space),
            self::APPROVED => $mail
                ->subject('Votre fiche est validée - ProtectIci')
                ->line('Bonne nouvelle : la fiche « '.$this->name.' » a été validée et est désormais publiée sur ProtectIci.')
                ->action('Voir ma fiche publique', $public)
                ->line('Vous pouvez la compléter à tout moment depuis votre espace.'),
            self::REJECTED => $mail
                ->subject('Votre fiche n\'a pas été validée - ProtectIci')
                ->line('La fiche « '.$this->name.' » n\'a pas pu être validée.')
                ->line('Motif : '.$this->reason)
                ->line('Vous pouvez corriger votre fiche puis la soumettre à nouveau.')
                ->action('Corriger ma fiche', $space),
            self::SUSPENDED => $mail
                ->subject('Votre fiche est suspendue - ProtectIci')
                ->line('La fiche « '.$this->name.' » a été suspendue : elle n\'est plus visible sur ProtectIci.')
                ->line('Motif : '.$this->reason)
                ->line('Pour toute question, contactez l\'équipe ProtectIci.'),
            self::CHANGE_APPROVED => $mail
                ->subject('Votre demande de modification est approuvée - ProtectIci')
                ->line('Votre demande de modification pour la fiche « '.$this->name.' » a été approuvée et appliquée.')
                ->action('Voir ma fiche', $space),
            default => $mail
                ->subject('Votre demande de modification est refusée - ProtectIci')
                ->line('Votre demande de modification pour la fiche « '.$this->name.' » a été refusée.')
                ->line('Motif : '.$this->reason)
                ->action('Voir ma fiche', $space),
        };

        return $mail->salutation('L\'équipe ProtectIci');
    }
}
