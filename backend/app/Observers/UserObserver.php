<?php

namespace App\Observers;

use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Auth\SessionInvalidator;

/**
 * Audit des changements sensibles (security.md §12, §20) : rôle et statut d'activation.
 * Un compte désactivé perd immédiatement ses sessions.
 */
class UserObserver
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SessionInvalidator $sessions,
    ) {}

    public function updated(User $user): void
    {
        if ($user->wasChanged('role')) {
            $this->audit->record('role_changed', $user,
                ['role' => $user->getOriginal('role')],
                ['role' => $user->role],
            );
        }

        if ($user->wasChanged('is_active')) {
            $this->audit->record('account_status_changed', $user,
                ['is_active' => (bool) $user->getOriginal('is_active')],
                ['is_active' => $user->is_active],
            );

            if (! $user->is_active) {
                $this->sessions->destroyAll($user);
            }
        }
    }
}
