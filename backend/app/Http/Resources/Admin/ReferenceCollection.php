<?php

namespace App\Http\Resources\Admin;

use App\Http\Resources\PaginatedCollection;

class ReferenceCollection extends PaginatedCollection
{
    public $collects = ReferenceResource::class;
}
