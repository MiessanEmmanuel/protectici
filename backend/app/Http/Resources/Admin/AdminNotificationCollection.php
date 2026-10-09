<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\PaginatedCollection;
use Illuminate\Http\Request;

/** Liste paginée + `meta.unread_count` (notifications non lues de l'administrateur connecté). */
class AdminNotificationCollection extends PaginatedCollection
{
    public $collects = AdminNotificationResource::class;

    public int $unreadCount = 0;

    public function withUnreadCount(int $count): static
    {
        $this->unreadCount = $count;

        return $this;
    }

    /**
     * @param  Request  $request
     * @param  array<string, mixed>  $paginated
     * @param  array<string, mixed>  $default
     * @return array<string, mixed>
     */
    public function paginationInformation($request, $paginated, $default): array
    {
        $info = parent::paginationInformation($request, $paginated, $default);
        $info['meta']['unread_count'] = $this->unreadCount;

        return $info;
    }
}
