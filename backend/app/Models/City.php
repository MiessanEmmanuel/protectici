<?php

namespace App\Models;

use Database\Factories\CityFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $latitude
 * @property string|null $longitude
 */
class City extends Model
{
    /** @use HasFactory<CityFactory> */
    use HasFactory;

    protected $fillable = ['name', 'slug', 'country_code', 'latitude', 'longitude', 'sort_order'];

    protected $hidden = ['location'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean', 'sort_order' => 'integer'];
    }

    /** @return HasMany<District, $this> */
    public function districts(): HasMany
    {
        return $this->hasMany(District::class);
    }

    /**
     * @param  Builder<City>  $query
     * @return Builder<City>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('cities.is_visible', true);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
