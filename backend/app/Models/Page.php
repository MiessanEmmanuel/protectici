<?php

namespace App\Models;

use Database\Factories\PageFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string $body
 * @property string|null $seo_title
 * @property string|null $seo_description
 * @property bool $is_visible
 * @property Carbon|null $updated_at
 */
class Page extends Model
{
    /** @use HasFactory<PageFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['slug', 'title', 'body', 'seo_title', 'seo_description'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
