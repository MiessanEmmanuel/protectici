<?php

namespace App\Policies;

use App\Models\User;

/**
 * Autorisations sur les comptes (security.md §12-§13) :
 * - lister : admin ;
 * - voir / modifier : soi-même ou admin ;
 * - changer le rôle ou le statut : admin uniquement, jamais sur son propre compte.
 */
class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isAdmin();
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->is($target) || $actor->isAdmin();
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->is($target) || $actor->isAdmin();
    }

    public function changeRole(User $actor, User $target): bool
    {
        return $actor->isAdmin() && ! $actor->is($target);
    }

    public function changeStatus(User $actor, User $target): bool
    {
        return $actor->isAdmin() && ! $actor->is($target);
    }

    /** Gestion d'un compte par l'administration (rôle, statut, anonymisation) ; les gardes métier sont dans UserAdministration. */
    public function administer(User $actor, User $target): bool
    {
        return $actor->isAdmin() && $actor->is_active;
    }
}
