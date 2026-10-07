<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

/**
 * Liste paginée au format du contrat : { data, meta: {current_page,last_page,per_page,total}, links: {next,prev} }.
 */
abstract class PaginatedCollection extends ResourceCollection
{
    /**
     * @param  Request  $request
     * @param  array<string, mixed>  $paginated
     * @param  array<string, mixed>  $default
     * @return array<string, mixed>
     */
    public function paginationInformation($request, $paginated, $default): array
    {
        return [
            'links' => [
                'next' => $paginated['next_page_url'] ?? null,
                'prev' => $paginated['prev_page_url'] ?? null,
            ],
            'meta' => [
                'current_page' => $paginated['current_page'],
                'last_page' => $paginated['last_page'],
                'per_page' => $paginated['per_page'],
                'total' => $paginated['total'],
            ],
        ];
    }
}
