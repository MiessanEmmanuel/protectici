<?php

namespace App\Services\Auth;

use App\Models\User;

/** Mise à jour du profil : uniquement prénom, nom, téléphone (liste blanche du FormRequest). */
class UpdateProfile
{
    /**
     * @param  array{first_name?: string, last_name?: string, phone?: string|null}  $data
     */
    public function handle(User $user, array $data): User
    {
        $user->fill(array_intersect_key($data, array_flip(['first_name', 'last_name', 'phone'])));
        $user->save();

        return $user;
    }
}
