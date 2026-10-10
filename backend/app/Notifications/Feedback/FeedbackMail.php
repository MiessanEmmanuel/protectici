<?php

namespace App\Notifications\Feedback;

use App\Support\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mails « Dis-moi tout » (contrat §8.2), envoyés uniquement à l'adresse du dossier (jamais à un tiers) :
 * accusé de réception avec la référence, puis réponse de l'équipe. Mis en file (driver database).
 */
class FeedbackMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public const RECEIVED = 'received';

    public const REPLY = 'reply';

    public int $tries = 3;

    public function __construct(
        public readonly string $event,
        public readonly string $reference,
        public readonly string $firstName,
        public readonly ?string $body = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');
        $mail = (new MailMessage)->greeting('Bonjour '.MailText::plain($this->firstName).',');

        if ($this->event === self::RECEIVED) {
            $mail->subject('Votre message a bien été reçu - ProtectIci')
                ->line('Nous avons bien reçu votre message « Dis-moi tout ».')
                ->line('Votre numéro de suivi : '.$this->reference)
                ->line('Conservez-le : il vous permet de suivre l\'avancement de votre dossier avec votre adresse e-mail.')
                ->action('Suivre mon dossier', $front.'/dis-moi-tout/suivi');
        } else {
            $mail->subject('Réponse à votre dossier '.$this->reference.' - ProtectIci')
                ->line('Notre équipe a répondu à votre dossier '.$this->reference.' :');
            foreach (MailText::lines((string) $this->body) as $line) {
                $mail->line($line);
            }
            $mail->action('Voir mon dossier', $front.'/dis-moi-tout/suivi');
        }

        return $mail->salutation('L\'équipe ProtectIci');
    }
}
