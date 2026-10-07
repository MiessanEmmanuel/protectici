<?php

namespace App\Http\Resources;

use App\Models\StateForce;
use Illuminate\Http\Request;

class StateForceDetailResource extends StateForceSummaryResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var StateForce $f */
        $f = $this->resource;

        return parent::toArray($request) + [
            'description' => $f->description ?? '',
            'email' => $f->email,
            'geo_description' => $f->geo_description,
            'plus_code' => $f->plus_code,
            'opening_hours' => $f->opening_hours,
            'procedures' => $f->procedureTypes->map(fn ($p) => [
                'slug' => $p->slug,
                'name' => $p->name,
                'notes' => data_get($p, 'pivot.notes'),
            ])->values(),
        ];
    }
}
