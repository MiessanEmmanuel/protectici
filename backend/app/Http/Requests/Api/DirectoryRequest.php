<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Base des requêtes de listing public : liste blanche stricte, paramètres inconnus ignorés (security.md §14).
 */
abstract class DirectoryRequest extends FormRequest
{
    public const MAX_PER_PAGE = 50;

    public const DEFAULT_PER_PAGE = 12;

    private const SLUG = 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    private const SLUG_LIST = 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*)*$/';

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    protected function commonRules(): array
    {
        return [
            'filter' => ['sometimes', 'array'],
            'filter.q' => ['nullable', 'string', 'min:1', 'max:100'],
            'filter.city' => ['nullable', 'string', 'max:140', self::SLUG],
            'filter.district' => ['nullable', 'string', 'max:140', self::SLUG],
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lng', 'required_if:sort,distance'],
            'lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat', 'required_if:sort,distance'],
            'radius_km' => ['nullable', 'numeric', 'min:0.1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @return list<string> */
    protected function slugListRule(): array
    {
        return ['nullable', 'string', 'max:500', self::SLUG_LIST];
    }

    /** @return list<string> */
    protected function slugRule(): array
    {
        return ['nullable', 'string', 'max:140', self::SLUG];
    }

    public function perPage(): int
    {
        return max(1, min(self::MAX_PER_PAGE, (int) ($this->validated('per_page') ?? self::DEFAULT_PER_PAGE)));
    }

    /**
     * Filtres normalisés (listes séparées par des virgules => tableaux).
     *
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        $v = $this->validated();
        $filter = $v['filter'] ?? [];

        $list = fn (?string $value): array => $value === null ? [] : array_slice(array_values(array_unique(explode(',', $value))), 0, 10);

        return array_filter([
            'q' => isset($filter['q']) ? trim($filter['q']) : null,
            'city' => $filter['city'] ?? null,
            'district' => $filter['district'] ?? null,
            'service' => $list($filter['service'] ?? null),
            'company_type' => $list($filter['company_type'] ?? null),
            'type' => $list($filter['type'] ?? null),
            'procedure' => $list($filter['procedure'] ?? null),
            'lat' => $v['lat'] ?? null,
            'lng' => $v['lng'] ?? null,
            'radius_km' => $v['radius_km'] ?? null,
            'sort' => $v['sort'] ?? null,
        ], fn ($value) => $value !== null && $value !== []);
    }
}
