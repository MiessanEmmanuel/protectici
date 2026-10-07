<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Envoyé quand quelqu'un tente de s'inscrire avec une adresse déjà associée à un compte vérifié. */
class AlreadyRegisteredNotification extends Notification
{
    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');

        return (new MailMessage)
            ->subject('Vous avez déjà un compte - ProtectIci')
            ->greeting('Bonjour,')
            ->line('Une inscription vient d\'être demandée avec cette adresse e-mail, mais un compte ProtectIci existe déjà.')
            ->action('Me connecter', $front.'/connexion')
            ->line('Mot de passe oublié ? Vous pouvez le réinitialiser ici : '.$front.'/mot-de-passe-oublie')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : votre compte n\'a pas été modifié.')
            ->salutation('L\'équipe ProtectIci');
    }
}
