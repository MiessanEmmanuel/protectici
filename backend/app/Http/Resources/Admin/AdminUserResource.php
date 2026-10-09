<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdminUser du contrat (docs/api-contract.md §7.1). Le compte doit venir de UserAdministration::query()
 * (attribut `establishments_count` calculé en SQL : aucun chargement paresseux).
 *
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;

        return [
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'is_active' => (bool) $user->is_active,
            'email_verified' => $user->email_verified_at !== null,
            'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            'last_login_at' => $user->last_login_at?->toImmutable()->utc()->format('Y-m-d\TH:i:s\Z'),
            'created_at' => $user->created_at?->toImmutable()->utc()->format('Y-m-d\TH:i:s\Z'),
            'establishments_count' => (int) $user->getAttribute('establishments_count'),
        ];
    }
}
