<?php

namespace App\Http\Resources;

use App\Models\Provider;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ProviderSummary (contrat §2). Ne contient aucune donnée privée.
 *
 * @mixin Provider
 */
class ProviderSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Provider $p */
        $p = $this->resource;
        $distance = $p->getAttributes()['distance_m'] ?? null;

        return [
            'slug' => $p->slug,
            'name' => $p->name,
            'logo_url' => $p->logo?->url(),
            'city' => ['name' => $p->city->name, 'slug' => $p->city->slug],
            'district' => $p->district ? ['name' => $p->district->name, 'slug' => $p->district->slug] : null,
            'phone' => $p->phone,
            'services' => $p->serviceTypes->map(fn ($s) => ['slug' => $s->slug, 'name' => $s->name])->values(),
            'price_from' => $p->price_from,
            'rating_avg' => round((float) $p->rating_avg, 1),
            'rating_count' => $p->rating_count,
            'is_verified' => $p->is_verified,
            'is_featured' => $p->is_featured,
            'lat' => $p->latitude === null ? null : (float) $p->latitude,
            'lng' => $p->longitude === null ? null : (float) $p->longitude,
            'distance_m' => $distance === null ? null : (int) round((float) $distance),
        ];
    }
}
