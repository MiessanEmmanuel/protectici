<?php

namespace App\Policies;

use App\Models\Provider;
use App\Models\Review;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ReviewPolicy
{
    private function isPublished(Review $review): bool
    {
        return $review->is_visible && $review->status === 'approved' && $review->deleted_at === null;
    }

    private function isAuthor(?User $user, Review $review): bool
    {
        return $user !== null && $review->user_id !== null && $review->user_id === $user->id;
    }

    public function view(?User $user, Review $review): bool
    {
        return $this->isPublished($review) || $this->isAuthor($user, $review) || ($user?->isAdmin() ?? false);
    }

    /** Compte vérifié, fiche publiée, un seul avis par prestataire (RG3). */
    public function create(User $user, Provider $provider): Response
    {
        if (! $user->hasVerifiedEmail()) {
            return Response::deny('Veuillez vérifier votre adresse e-mail pour publier un avis.');
        }
        if (! ($provider->is_visible && $provider->status === 'approved')) {
            return Response::denyAsNotFound();
        }
        if ($provider->user_id !== null && $provider->user_id === $user->id) {
            return Response::deny('Vous ne pouvez pas donner d\'avis sur votre propre fiche.');
        }
        if (Review::query()->where('provider_id', $provider->id)->where('user_id', $user->id)->exists()) {
            return Response::deny('Vous avez déjà donné votre avis sur ce prestataire.');
        }

        return Response::allow();
    }

    /** L'auteur tant que l'avis n'est pas modéré ; l'admin toujours. */
    public function update(User $user, Review $review): bool
    {
        return $user->isAdmin() || ($this->isAuthor($user, $review) && $review->status === 'pending');
    }

    /** Modification par l'auteur (contrat §8.1) : l'avis repasse en modération, quel que soit son statut. */
    public function edit(User $user, Review $review): bool
    {
        return $this->isAuthor($user, $review) && $review->deleted_at === null;
    }

    public function delete(User $user, Review $review): bool
    {
        return $user->isAdmin() || $this->isAuthor($user, $review);
    }

    public function moderate(User $user, Review $review): bool
    {
        return $user->isAdmin();
    }

    /** Réponse unique du propriétaire de la fiche (RG3). */
    public function reply(User $user, Review $review): bool
    {
        if ($review->provider_reply !== null || ! $this->isPublished($review)) {
            return false;
        }

        $ownerId = Provider::query()->whereKey($review->provider_id)->value('user_id');

        return $ownerId !== null && $ownerId === $user->id;
    }

    public function report(User $user, Review $review): bool
    {
        return $user->hasVerifiedEmail() && $this->isPublished($review) && ! $this->isAuthor($user, $review);
    }
}
