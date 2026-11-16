<?php

namespace App\Policies;

use App\Models\EstablishmentImport;
use App\Models\User;

/** Import Excel des fiches : administrateurs uniquement (contrat §10.2). */
class EstablishmentImportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() && $user->is_active;
    }

    public function view(User $user, EstablishmentImport $import): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, EstablishmentImport $import): bool
    {
        return $this->viewAny($user);
    }
}
