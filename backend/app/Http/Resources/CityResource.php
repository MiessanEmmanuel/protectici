<?php

namespace App\Http\Resources;

use App\Models\City;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin City
 *
 * City { id, name, slug, lat, lng, districts: [District] } */
class CityResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'lat' => $this->latitude === null ? null : (float) $this->latitude,
            'lng' => $this->longitude === null ? null : (float) $this->longitude,
            'districts' => $this->districts->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'slug' => $d->slug,
                'parent_id' => $d->parent_id,
            ])->values(),
        ];
    }
}
