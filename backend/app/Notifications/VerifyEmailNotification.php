<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

/**
 * Vérification de l'adresse email : lien signé (60 min) vers l'API
 * /api/v1/auth/verify-email/{id}/{hash}, qui redirige ensuite vers le front.
 * Pas de ShouldQueue pour l'instant (pas de worker local).
 */
class VerifyEmailNotification extends Notification
{
    public const EXPIRE_MINUTES = 60;

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirmez votre adresse e-mail - ProtectIci')
            ->greeting('Bonjour '.$notifiable->first_name.',')
            ->line('Merci pour votre inscription sur ProtectIci. Pour activer toutes les fonctionnalités de votre compte, veuillez confirmer votre adresse e-mail.')
            ->action('Confirmer mon adresse e-mail', $this->verificationUrl($notifiable))
            ->line('Ce lien expire dans '.self::EXPIRE_MINUTES.' minutes.')
            ->line('Si vous n\'êtes pas à l\'origine de cette inscription, ignorez simplement ce message.')
            ->salutation('L\'équipe ProtectIci');
    }

    public function verificationUrl(User $notifiable): string
    {
        return URL::temporarySignedRoute(
            'auth.verification.verify',
            Carbon::now()->addMinutes(self::EXPIRE_MINUTES),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
        );
    }
}
