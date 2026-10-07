<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Lien de réinitialisation vers le front : {FRONTEND_URL}/reinitialiser-mot-de-passe?token=…&email=…
 * (base issue de la configuration uniquement : jamais de la requête).
 */
class ResetPasswordNotification extends Notification
{
    public function __construct(#[\SensitiveParameter] public readonly string $token) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $expire = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject('Réinitialisation de votre mot de passe - ProtectIci')
            ->greeting('Bonjour '.$notifiable->first_name.',')
            ->line('Vous recevez ce message car une demande de réinitialisation du mot de passe a été faite pour votre compte.')
            ->action('Réinitialiser mon mot de passe', $this->resetUrl($notifiable))
            ->line('Ce lien expire dans '.$expire.' minutes.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, aucune action n\'est requise : votre mot de passe reste inchangé.')
            ->salutation('L\'équipe ProtectIci');
    }

    public function resetUrl(User $notifiable): string
    {
        return config('auth.frontend_url').'/reinitialiser-mot-de-passe?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], '', '&', PHP_QUERY_RFC3986);
    }
}
