<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\PaginatedCollection;

class AdminUserCollection extends PaginatedCollection
{
    public $collects = AdminUserResource::class;
}
