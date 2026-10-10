<?php

namespace App\Notifications\Quote;

use App\Support\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mails des demandes de devis (contrat §8.3), en file d'attente après validation de la transaction.
 * - ACKNOWLEDGED : accusé de réception au demandeur ;
 * - RECEIVED : « nouveau devis » au prestataire destinataire, SANS texte libre ni coordonnées du demandeur
 *   (référence + lien vers l'espace) ;
 * - REPLIED : réponse du prestataire au demandeur (message du prestataire passé par MailText + montant).
 * Un refus du prestataire n'envoie aucun e-mail.
 */
class QuoteMail extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public const ACKNOWLEDGED = 'acknowledged';

    public const RECEIVED = 'received';

    public const REPLIED = 'replied';

    public int $tries = 3;

    public function __construct(
        public readonly string $event,
        public readonly string $reference,
        public readonly ?string $name = null,
        public readonly ?string $providerName = null,
        public readonly ?string $message = null,
        public readonly ?int $amount = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $front = rtrim((string) config('auth.frontend_url'), '/');
        $hello = $this->name === null || $this->name === '' ? 'Bonjour,' : 'Bonjour '.MailText::plain($this->name).',';
        $mail = (new MailMessage)->greeting($hello);

        match ($this->event) {
            self::ACKNOWLEDGED => $mail
                ->subject('Votre demande de devis a bien été reçue - ProtectIci')
                ->line('Nous avons bien reçu votre demande de devis, référence '.$this->reference.'.')
                ->line('Les prestataires concernés vous répondront directement par e-mail ou par téléphone.'),
            self::RECEIVED => $mail
                ->subject('Nouvelle demande de devis - ProtectIci')
                ->line('Une nouvelle demande de devis (référence '.$this->reference.') est arrivée dans votre espace prestataire.')
                ->line('Connectez-vous pour la consulter et y répondre.')
                ->action('Voir la demande', $front.'/espace-prestataire/devis'),
            default => $this->replied($mail),
        };

        return $mail->salutation('L\'équipe ProtectIci');
    }

    private function replied(MailMessage $mail): MailMessage
    {
        $mail->subject('Réponse à votre demande de devis - ProtectIci')
            ->line('Le prestataire '.MailText::plain((string) $this->providerName).' a répondu à votre demande de devis, référence '.$this->reference.'.');

        if ($this->amount !== null) {
            $mail->line('Montant proposé : '.number_format($this->amount, 0, ',', ' ').' FCFA.');
        }
        foreach (MailText::lines((string) $this->message) as $line) {
            $mail->line($line);
        }

        return $mail->line('Pour donner suite, contactez directement le prestataire.');
    }
}
