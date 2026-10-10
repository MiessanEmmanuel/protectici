<?php

namespace App\Notifications\Reviews;

use App\Models\User;
use App\Support\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mails à l'auteur d'un avis (contrat §8.1) : avis publié, avis non retenu (avec motif), réponse du prestataire.
 * Mis en file après validation de la transaction ; le texte saisi par un tiers (motif, réponse) est neutralisé
 * par MailText. Ne contient aucune donnée personnelle autre que le prénom du destinataire.
 */
class ReviewMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const REPLIED = 'replied';

    public int $tries = 3;

    public function __construct(
        public readonly string $event,
        public readonly string $providerName,
        public readonly string $providerSlug,
        public readonly ?string $text = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');
        $page = $front.'/annuaire/'.$this->providerSlug;
        $name = MailText::plain($this->providerName);

        $mail = (new MailMessage)->greeting('Bonjour '.MailText::plain((string) $notifiable->first_name).',');

        match ($this->event) {
            self::APPROVED => $mail
                ->subject('Votre avis est publié - ProtectIci')
                ->line('Votre avis sur « '.$name.' » a été validé et est désormais visible sur ProtectIci. Merci de votre contribution.')
                ->action('Voir l\'avis', $page),
            self::REJECTED => $this->rejected($mail, $name, $page),
            default => $this->replied($mail, $name, $page),
        };

        return $mail->salutation('L\'équipe ProtectIci');
    }

    private function rejected(MailMessage $mail, string $name, string $page): MailMessage
    {
        $mail->subject('Votre avis n\'a pas été retenu - ProtectIci')
            ->line('Votre avis sur « '.$name.' » n\'a pas pu être publié.');
        foreach (MailText::lines((string) $this->text) as $line) {
            $mail->line('Motif : '.$line);
        }

        return $mail->line('Vous pouvez le modifier depuis votre espace : il sera alors examiné à nouveau.')
            ->action('Voir le prestataire', $page);
    }

    private function replied(MailMessage $mail, string $name, string $page): MailMessage
    {
        $mail->subject('Le prestataire a répondu à votre avis - ProtectIci')
            ->line('« '.$name.' » a répondu à votre avis :');
        foreach (MailText::lines((string) $this->text) as $line) {
            $mail->line($line);
        }

        return $mail->action('Voir la réponse', $page);
    }
}
