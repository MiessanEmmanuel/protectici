<?php

namespace App\Http\Resources\Claims;

use App\Enums\EstablishmentType;
use App\Models\EstablishmentClaim;
use App\Support\ApiPage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MyClaim (contrat §10.1) : vue du demandeur. Ni téléphone, ni justificatif, ni relecteur.
 * Relations attendues : provider et stateForce (withTrashed), chargées par ClaimService::RELATIONS.
 *
 * @mixin EstablishmentClaim
 */
class MyClaimResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var EstablishmentClaim $claim */
        $claim = $this->resource;

        return [
            'id' => $claim->id,
            'status' => $claim->status,
            'establishment' => self::establishment($claim),
            'rejection_reason' => $claim->rejection_reason,
            'created_at' => ApiPage::iso($claim->created_at),
            'reviewed_at' => ApiPage::iso($claim->reviewed_at),
        ];
    }

    /** @return array{type: string, slug: string|null, name: string|null} */
    public static function establishment(EstablishmentClaim $claim): array
    {
        $establishment = $claim->establishment();

        return [
            'type' => $claim->provider_id !== null ? EstablishmentType::Provider->value : EstablishmentType::StateForce->value,
            'slug' => $establishment?->slug,
            'name' => $establishment?->name,
        ];
    }
}
