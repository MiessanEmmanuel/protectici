<?php

namespace App\Http\Resources\Claims;

use App\Models\EstablishmentClaim;
use App\Models\User;
use App\Support\ApiPage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdminClaim (contrat §10.1) : réservé à l'administration (rôle admin + 2FA). Le justificatif n'est décrit que par
 * ses métadonnées (nom d'origine assaini, type détecté, taille) ; son contenu passe par la route de téléchargement
 * journalisée, jamais par une URL publique.
 *
 * @mixin EstablishmentClaim
 */
class AdminClaimResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var EstablishmentClaim $claim */
        $claim = $this->resource;
        $establishment = $claim->establishment();
        $base = MyClaimResource::establishment($claim);

        return [
            'id' => $claim->id,
            'status' => $claim->status,
            'establishment' => [
                'type' => $base['type'],
                'id' => $claim->provider_id ?? $claim->state_force_id,
                'slug' => $base['slug'],
                'name' => $base['name'],
                'city' => $establishment?->city === null ? null : ['name' => $establishment->city->name],
            ],
            'user' => self::person($claim->user, withEmail: true),
            'submitter_role' => $claim->submitter_role,
            'phone' => $claim->phone,
            'message' => $claim->message,
            'document' => $claim->document_path === null ? null : [
                'name' => $claim->document_original_name,
                'mime_type' => $claim->document_mime_type,
                'size_bytes' => $claim->document_size_bytes,
            ],
            'rejection_reason' => $claim->rejection_reason,
            'reviewer' => self::person($claim->reviewer, withEmail: false),
            'created_at' => ApiPage::iso($claim->created_at),
            'reviewed_at' => ApiPage::iso($claim->reviewed_at),
        ];
    }

    /** @return array<string, mixed>|null */
    private static function person(?User $user, bool $withEmail): ?array
    {
        if ($user === null) {
            return null;
        }

        $data = ['id' => $user->id, 'name' => trim($user->first_name.' '.$user->last_name)];

        return $withEmail ? $data + ['email' => $user->email] : $data;
    }
}
