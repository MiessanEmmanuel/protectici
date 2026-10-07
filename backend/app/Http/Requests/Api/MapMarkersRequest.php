<?php

namespace App\Http\Requests\Api;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** `type` (providers|state_forces) est distinct de `filter[type]` (type de force). */
class MapMarkersRequest extends DirectoryRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->commonRules() + [
            'type' => ['required', 'string', Rule::in(['providers', 'state_forces'])],
            'bbox' => ['nullable', 'string', 'regex:/^-?\d{1,3}(\.\d+)?(,-?\d{1,3}(\.\d+)?){3}$/'],
            'filter.service' => $this->slugListRule(),
            'filter.company_type' => $this->slugListRule(),
            'filter.type' => $this->slugListRule(),
            'filter.procedure' => $this->slugListRule(),
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $bbox = $this->input('bbox');
            if (! is_string($bbox) || $bbox === '' || $validator->errors()->has('bbox')) {
                return;
            }
            [$minLng, $minLat, $maxLng, $maxLat] = array_map('floatval', explode(',', $bbox));
            $valid = $minLng >= -180 && $maxLng <= 180 && $minLat >= -90 && $maxLat <= 90
                && $minLng < $maxLng && $minLat < $maxLat;
            if (! $valid) {
                $validator->errors()->add('bbox', 'La zone demandée est invalide.');
            }
        });
    }

    /** @return array{0: float, 1: float, 2: float, 3: float}|null */
    public function bbox(): ?array
    {
        $bbox = $this->validated('bbox');

        return $bbox ? array_map('floatval', explode(',', $bbox)) : null;
    }
}
