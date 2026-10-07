<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 *
 * Base des référentiels (slug / name / description / sort_order / is_visible).
 * `is_visible` n'est pas assignable en masse (écrit par l'administration via action dédiée).
 */
abstract class ReferenceModel extends Model
{
    protected $fillable = ['slug', 'name', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean', 'sort_order' => 'integer'];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where($this->qualifyColumn('is_visible'), true);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy($this->qualifyColumn('sort_order'))->orderBy($this->qualifyColumn('name'));
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
