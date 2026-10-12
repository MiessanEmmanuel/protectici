<?php

namespace App\Notifications\Newsletter;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** E-mail de confirmation d'abonnement (double opt-in) : lien signé 24 h + lien de désinscription. Mis en file. */
class NewsletterMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $confirmUrl, public readonly string $unsubscribeUrl) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirmez votre abonnement à la lettre d\'information - ProtectIci')
            ->greeting('Bonjour,')
            ->line('Vous avez demandé à recevoir la lettre d\'information de ProtectIci. Pour confirmer votre abonnement, cliquez sur le bouton ci-dessous.')
            ->action('Confirmer mon abonnement', $this->confirmUrl)
            ->line('Ce lien est valable 24 heures. Sans confirmation de votre part, aucun message ne vous sera envoyé.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement ce message ou [vous désinscrire]('.$this->unsubscribeUrl.').')
            ->salutation('L\'équipe ProtectIci');
    }
}
