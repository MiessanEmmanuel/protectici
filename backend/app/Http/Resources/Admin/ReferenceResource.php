<?php

namespace App\Http\Resources\Admin;

use App\Models\City;
use App\Models\District;
use App\Models\ServiceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Valeur de référentiel côté administration (inclut les valeurs masquées).
 *
 * @mixin Model
 */
class ReferenceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $item = $this->resource;

        if ($item instanceof City) {
            return [
                'id' => $item->id,
                'slug' => $item->slug,
                'name' => $item->name,
                'lat' => $item->latitude === null ? null : (float) $item->latitude,
                'lng' => $item->longitude === null ? null : (float) $item->longitude,
                'sort_order' => (int) $item->sort_order,
                'is_visible' => (bool) $item->getAttribute('is_visible'),
            ];
        }

        if ($item instanceof District) {
            return [
                'id' => $item->id,
                'slug' => $item->slug,
                'name' => $item->name,
                'city_id' => $item->city_id,
                'parent_id' => $item->parent_id,
                'lat' => $item->latitude === null ? null : (float) $item->latitude,
                'lng' => $item->longitude === null ? null : (float) $item->longitude,
                'is_visible' => (bool) $item->getAttribute('is_visible'),
            ];
        }

        $data = [
            'id' => $item->getAttribute('id'),
            'slug' => $item->getAttribute('slug'),
            'name' => $item->getAttribute('name'),
            'description' => $item->getAttribute('description'),
            'sort_order' => (int) $item->getAttribute('sort_order'),
            'is_visible' => (bool) $item->getAttribute('is_visible'),
        ];

        if ($item instanceof ServiceType) {
            $data['icon'] = $item->getAttribute('icon');
        }

        return $data;
    }
}
