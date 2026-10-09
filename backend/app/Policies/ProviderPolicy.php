<?php

namespace App\Policies;

use App\Models\Provider;
use App\Models\User;
use App\Policies\Concerns\ManagesOwnEstablishment;
use Illuminate\Auth\Access\Response;

class ProviderPolicy
{
    use ManagesOwnEstablishment;

    private function isPublished(Provider $provider): bool
    {
        return $provider->is_visible && $provider->status === 'approved' && $provider->deleted_at === null;
    }

    private function isOwner(?User $user, Provider $provider): bool
    {
        return $user !== null && $provider->user_id !== null && $provider->user_id === $user->id;
    }

    public function viewAny(?User $user): bool
    {
        return true;
    }

    /** Fiche publiée : tout le monde ; sinon propriétaire ou admin. */
    public function view(?User $user, Provider $provider): bool
    {
        return $this->isPublished($provider) || $this->isOwner($user, $provider) || ($user?->isAdmin() ?? false);
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [User::ROLE_PROVIDER, User::ROLE_ADMIN], true);
    }

    /** Champs non sensibles : propriétaire ou admin. */
    public function update(User $user, Provider $provider): bool
    {
        return $user->isAdmin() || $this->isOwner($user, $provider);
    }

    /** Champs sensibles (RCCM, agrément, raison sociale…) : admin uniquement (le propriétaire passe par une demande de modification). */
    public function updateSensitive(User $user, Provider $provider): bool
    {
        return $user->isAdmin();
    }

    /** Demande de modification des champs sensibles : propriétaire, fiche non suspendue. */
    public function requestChange(User $user, Provider $provider): bool
    {
        return $this->isOwner($user, $provider) && $provider->status !== 'suspended';
    }

    public function approve(User $user, Provider $provider): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Provider $provider): bool
    {
        return $user->isAdmin();
    }

    public function favorite(User $user, Provider $provider): Response
    {
        if (! $user->hasVerifiedEmail()) {
            return Response::deny('Veuillez vérifier votre adresse e-mail pour ajouter des favoris.');
        }

        return $this->isPublished($provider) ? Response::allow() : Response::denyAsNotFound();
    }
}
