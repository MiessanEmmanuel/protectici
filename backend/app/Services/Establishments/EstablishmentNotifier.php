<?php

namespace App\Services\Establishments;

use App\Enums\EstablishmentType;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Establishment\EstablishmentMail;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Point unique d'envoi des e-mails au propriétaire et des notifications internes aux administrateurs.
 * L'appelant n'invoque ces méthodes que lors d'une VRAIE transition (jamais pour une action rejouée) :
 * c'est ce qui garantit qu'aucun e-mail n'est envoyé deux fois. Un échec d'envoi est journalisé (sans
 * donnée personnelle) et n'annule jamais l'action de l'administrateur.
 */
class EstablishmentNotifier
{
    public function submitted(Provider|StateForce $establishment, User $owner): void
    {
        $this->mail($owner, EstablishmentMail::RECEIVED, $establishment);
        $this->alertAdmins(new AdminAlert(
            AdminAlert::KIND_ESTABLISHMENT_SUBMITTED,
            'Nouvelle fiche à valider',
            sprintf('La fiche « %s » (%s) attend une validation.', $establishment->name, $this->label($establishment)),
            $this->reference($establishment),
        ));
    }

    public function resubmitted(Provider|StateForce $establishment): void
    {
        $this->alertAdmins(new AdminAlert(
            AdminAlert::KIND_ESTABLISHMENT_SUBMITTED,
            'Fiche soumise à nouveau',
            sprintf('La fiche « %s » (%s) a été corrigée et soumise à nouveau.', $establishment->name, $this->label($establishment)),
            $this->reference($establishment),
        ));
    }

    public function approved(Provider|StateForce $establishment): void
    {
        $this->mailOwner($establishment, EstablishmentMail::APPROVED);
    }

    public function rejected(Provider|StateForce $establishment, string $reason): void
    {
        $this->mailOwner($establishment, EstablishmentMail::REJECTED, $reason);
    }

    public function suspended(Provider|StateForce $establishment, string $reason): void
    {
        $this->mailOwner($establishment, EstablishmentMail::SUSPENDED, $reason);
    }

    public function changeRequestSubmitted(Provider|StateForce $establishment): void
    {
        $this->alertAdmins(new AdminAlert(
            AdminAlert::KIND_CHANGE_REQUEST_SUBMITTED,
            'Nouvelle demande de modification',
            sprintf('Une demande de modification attend une décision pour la fiche « %s ».', $establishment->name),
            $this->reference($establishment),
        ));
    }

    public function changeRequestApproved(Provider|StateForce $establishment): void
    {
        $this->mailOwner($establishment, EstablishmentMail::CHANGE_APPROVED);
    }

    public function changeRequestRejected(Provider|StateForce $establishment, string $reason): void
    {
        $this->mailOwner($establishment, EstablishmentMail::CHANGE_REJECTED, $reason);
    }

    public function documentUploaded(Provider|StateForce $establishment): void
    {
        $this->alertAdmins(new AdminAlert(
            AdminAlert::KIND_DOCUMENT_UPLOADED,
            'Nouveau justificatif',
            sprintf('Un justificatif a été ajouté à la fiche « %s ».', $establishment->name),
            $this->reference($establishment),
        ));
    }

    /** Propriétaire de la fiche (chargé explicitement : pas de lazy loading). */
    private function mailOwner(Provider|StateForce $establishment, string $event, ?string $reason = null): void
    {
        $owner = $establishment->user_id === null ? null : User::query()->find($establishment->user_id);
        if ($owner instanceof User && $owner->is_active) {
            $this->mail($owner, $event, $establishment, $reason);
        }
    }

    private function mail(User $user, string $event, Provider|StateForce $establishment, ?string $reason = null): void
    {
        try {
            $user->notify(new EstablishmentMail(
                $event,
                $establishment->name,
                EstablishmentType::tryFromModel($establishment),
                $establishment->slug,
                $reason,
            ));
        } catch (Throwable $e) {
            // Aucune donnée personnelle dans le journal : seulement l'événement et la classe de l'erreur.
            report(new \RuntimeException('Échec d\'envoi d\'e-mail d\'établissement ('.$event.') : '.$e::class));
        }
    }

    private function alertAdmins(AdminAlert $alert): void
    {
        try {
            $admins = User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)->get();
            Notification::send($admins, $alert);
        } catch (Throwable $e) {
            report(new \RuntimeException('Échec de notification interne : '.$e::class));
        }
    }

    /** @return array{type: string, id: int, slug: string, name: string} */
    private function reference(Provider|StateForce $establishment): array
    {
        return [
            'type' => EstablishmentType::tryFromModel($establishment)->value,
            'id' => $establishment->id,
            'slug' => $establishment->slug,
            'name' => $establishment->name,
        ];
    }

    private function label(Provider|StateForce $establishment): string
    {
        return $establishment instanceof Provider ? 'prestataire' : 'force étatique';
    }
}
