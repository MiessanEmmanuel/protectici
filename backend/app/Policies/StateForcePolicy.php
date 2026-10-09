<?php

namespace App\Policies;

use App\Models\StateForce;
use App\Models\User;
use App\Policies\Concerns\ManagesOwnEstablishment;

class StateForcePolicy
{
    use ManagesOwnEstablishment;

    private function isPublished(StateForce $force): bool
    {
        return $force->is_visible && $force->status === 'approved' && $force->deleted_at === null;
    }

    public function viewAny(?User $user): bool
    {
        return true;
    }

    /** Fiche publiée : tout le monde ; sinon propriétaire ou admin. */
    public function view(?User $user, StateForce $force): bool
    {
        return $this->isPublished($force)
            || ($user !== null && $this->ownsEstablishment($user, $force))
            || ($user?->isAdmin() ?? false);
    }

    public function create(User $user): bool
    {
        return $user->is_active && $user->hasVerifiedEmail();
    }

    /** Champs non sensibles : propriétaire ou admin. */
    public function update(User $user, StateForce $force): bool
    {
        return $user->isAdmin() || $this->ownsEstablishment($user, $force);
    }

    /** Champs sensibles (raison sociale, type de force) : admin uniquement (le propriétaire passe par une demande). */
    public function updateSensitive(User $user, StateForce $force): bool
    {
        return $user->isAdmin();
    }

    public function requestChange(User $user, StateForce $force): bool
    {
        return $this->ownsEstablishment($user, $force) && $force->status !== 'suspended';
    }

    public function approve(User $user, StateForce $force): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, StateForce $force): bool
    {
        return $user->isAdmin();
    }
}
