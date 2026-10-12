<?php

namespace App\Models;

use Database\Factories\PartnerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $type
 * @property string $name
 * @property string|null $website_url
 * @property string|null $description
 * @property int $sort_order
 * @property bool $is_visible
 */
class Partner extends Model
{
    /** @use HasFactory<PartnerFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['type', 'name', 'website_url', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean', 'sort_order' => 'integer'];
    }

    /** @return MorphOne<Media, $this> */
    public function logo(): MorphOne
    {
        return $this->morphOne(Media::class, 'mediable')->where('collection', 'logo');
    }
}
