<?php

namespace App\Models;

use Database\Factories\ProviderExecutiveFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderExecutive extends Model
{
    /** @use HasFactory<ProviderExecutiveFactory> */
    use HasFactory;

    protected $fillable = ['provider_id', 'full_name', 'position', 'position_label', 'sort_order'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean', 'sort_order' => 'integer'];
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }
}
