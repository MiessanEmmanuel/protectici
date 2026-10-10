<?php

namespace App\Services\Notifications;

use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

/**
 * Point unique d'envoi (mise en file) des e-mails et des alertes internes. Les e-mails sont des notifications
 * `ShouldQueue` (driver `database`) : un échec d'envoi ou de mise en file est journalisé SANS donnée personnelle
 * et n'annule jamais l'action métier. L'appelant ne doit invoquer ces méthodes que lors d'une VRAIE transition
 * (jamais pour une action rejouée) : c'est ce qui garantit qu'un e-mail n'est jamais envoyé deux fois.
 */
class SafeNotifier
{
    /** E-mail à un utilisateur (notifiable). */
    public function toUser(?User $user, Notification $notification, string $context): void
    {
        if ($user === null || ! $user->is_active) {
            return;
        }
        try {
            $user->notify($notification);
        } catch (Throwable $e) {
            report(new \RuntimeException("Échec de mise en file d'e-mail ({$context}) : ".$e::class));
        }
    }

    /** E-mail à une adresse fournie par le demandeur lui-même (accusé) ou par un compte existant. */
    public function toAddress(?string $email, Notification $notification, string $context): void
    {
        if ($email === null || $email === '') {
            return;
        }
        try {
            NotificationFacade::route('mail', $email)->notify($notification);
        } catch (Throwable $e) {
            report(new \RuntimeException("Échec de mise en file d'e-mail ({$context}) : ".$e::class));
        }
    }

    /** Alerte interne (base de données) à tous les administrateurs actifs. */
    public function admins(AdminAlert $alert): void
    {
        try {
            $admins = User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)->get();
            NotificationFacade::send($admins, $alert);
        } catch (Throwable $e) {
            report(new \RuntimeException('Échec de notification interne : '.$e::class));
        }
    }
}
