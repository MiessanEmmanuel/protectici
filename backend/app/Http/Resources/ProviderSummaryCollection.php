<?php

namespace App\Http\Resources;

class ProviderSummaryCollection extends PaginatedCollection
{
    public $collects = ProviderSummaryResource::class;
}
