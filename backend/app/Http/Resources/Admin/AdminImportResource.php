<?php

namespace App\Http\Resources\Admin;

use App\Models\EstablishmentImport;
use App\Services\Imports\EstablishmentImportService;
use App\Support\ApiPage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdminImport (contrat §10.1). Le rapport par ligne n'est jamais inclus ici (voir rows()).
 *
 * @mixin EstablishmentImport
 */
class AdminImportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var EstablishmentImport $i */
        $i = $this->resource;
        $creator = $i->relationLoaded('creator') ? $i->creator : null;

        return [
            'id' => $i->id,
            'type' => $i->type,
            'status' => $i->status,
            'publish_mode' => $i->publish_mode,
            'original_name' => $i->original_name,
            'rows_total' => $i->rows_total,
            'rows_valid' => $i->rows_valid,
            'rows_invalid' => $i->rows_invalid,
            'rows_duplicate' => $i->rows_duplicate,
            'rows_created' => $i->rows_created,
            'failure_message' => $i->failure_message,
            'created_by' => $creator === null ? null : ['id' => $creator->id, 'name' => trim($creator->first_name.' '.$creator->last_name)],
            'created_at' => ApiPage::iso($i->created_at),
            'confirmed_at' => ApiPage::iso($i->confirmed_at),
            'finished_at' => ApiPage::iso($i->finished_at),
            'cancelled_at' => ApiPage::iso($i->cancelled_at),
            'can_confirm' => $i->status === 'ready' && $this->toCreate($i) > 0,
            'can_cancel' => in_array($i->status, ['ready', 'failed'], true) || ($i->status === 'done' && $i->cancelled_at === null),
        ];
    }

    /**
     * AdminImportRow : champs du contrat uniquement (les marqueurs internes du rapport ne sortent pas).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function row(array $row): array
    {
        return [
            'line' => (int) $row['line'],
            'name' => $row['name'] ?? null,
            'city' => $row['city'] ?? null,
            'status' => $row['status'],
            'errors' => array_values($row['errors'] ?? []),
            'duplicate_of' => $row['duplicate_of'] ?? null,
            'decision' => $row['status'] === 'duplicate' ? ($row['decision'] ?? 'skip') : null,
        ];
    }

    private function toCreate(EstablishmentImport $i): int
    {
        $precomputed = $i->getAttribute('rows_to_create');

        return $precomputed !== null ? (int) $precomputed : EstablishmentImportService::rowsToCreate($i->report);
    }
}
