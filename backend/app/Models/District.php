<?php

namespace App\Models;

use Database\Factories\DistrictFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string|null $latitude
 * @property string|null $longitude
 */
class District extends Model
{
    /** @use HasFactory<DistrictFactory> */
    use HasFactory;

    protected $fillable = ['city_id', 'parent_id', 'name', 'slug', 'latitude', 'longitude'];

    protected $hidden = ['location'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean'];
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @return BelongsTo<District, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(District::class, 'parent_id');
    }

    /**
     * @param  Builder<District>  $query
     * @return Builder<District>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('districts.is_visible', true);
    }
}
