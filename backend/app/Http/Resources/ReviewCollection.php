<?php

namespace App\Http\Resources;

class ReviewCollection extends PaginatedCollection
{
    public $collects = ReviewResource::class;
}
