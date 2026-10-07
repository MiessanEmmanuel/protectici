<?php

namespace App\Http\Resources;

use App\Models\ReferenceModel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ReferenceModel
 *
 * Option { id, slug, name } (types d'entreprise, de service, de force, de démarche). */
class OptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'slug' => $this->slug, 'name' => $this->name];
    }
}
