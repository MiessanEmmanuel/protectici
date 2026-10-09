<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\PaginatedCollection;

class AdminAuditLogCollection extends PaginatedCollection
{
    public $collects = AdminAuditLogResource::class;
}
