<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Notification interne : { id, kind, title, message, establishment, subject, read_at, created_at }.
 *
 * @mixin DatabaseNotification
 */
class AdminNotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var DatabaseNotification $notification */
        $notification = $this->resource;
        /** @var array<string, mixed> $data */
        $data = (array) $notification->data;

        return [
            'id' => $notification->id,
            'kind' => $data['kind'] ?? null,
            'title' => $data['title'] ?? null,
            'message' => $data['message'] ?? null,
            'establishment' => $data['establishment'] ?? null,
            'subject' => $data['subject'] ?? null,
            'read_at' => $notification->read_at?->toImmutable()->utc()->format('Y-m-d\TH:i:s\Z'),
            'created_at' => $notification->getAttribute('created_at')?->toImmutable()->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
