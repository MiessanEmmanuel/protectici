<?php

namespace App\Notifications\Contact;

use App\Support\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** E-mails du formulaire de contact (contrat §8.4) : accusé de réception, puis réponse de l'équipe. Mis en file. */
class ContactMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public const RECEIVED = 'received';

    public const REPLY = 'reply';

    public int $tries = 3;

    public function __construct(
        public readonly string $event,
        public readonly string $name,
        public readonly string $subjectLine,
        public readonly ?string $body = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->greeting('Bonjour '.MailText::plain($this->name).',');

        if ($this->event === self::RECEIVED) {
            $mail->subject('Votre message a bien été envoyé - ProtectIci')
                ->line('Nous avons bien reçu votre message « '.MailText::plain($this->subjectLine).' ».')
                ->line('Notre équipe vous répondra dans les meilleurs délais.');
        } else {
            $mail->subject('Réponse à votre message - ProtectIci')
                ->line('Notre équipe répond à votre message « '.MailText::plain($this->subjectLine).' » :');
            foreach (MailText::lines((string) $this->body) as $line) {
                $mail->line($line);
            }
        }

        return $mail->salutation('L\'équipe ProtectIci');
    }
}
