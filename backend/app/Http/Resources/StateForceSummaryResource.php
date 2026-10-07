<?php

namespace App\Http\Resources;

use App\Models\StateForce;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** StateForceSummary (contrat §2). */
class StateForceSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var StateForce $f */
        $f = $this->resource;
        $distance = $f->getAttributes()['distance_m'] ?? null;

        return [
            'slug' => $f->slug,
            'name' => $f->name,
            'force_type' => new OptionResource($f->forceType),
            'phone' => $f->phone,
            'emergency_phone' => $f->emergency_phone,
            'city' => ['name' => $f->city->name, 'slug' => $f->city->slug],
            'district' => $f->district ? ['name' => $f->district->name, 'slug' => $f->district->slug] : null,
            'address' => $f->address,
            'is_open_24h' => $f->is_open_24h,
            'lat' => $f->latitude === null ? null : (float) $f->latitude,
            'lng' => $f->longitude === null ? null : (float) $f->longitude,
            'distance_m' => $distance === null ? null : (int) round((float) $distance),
        ];
    }
}
