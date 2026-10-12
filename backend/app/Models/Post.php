<?php

namespace App\Models;

use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string|null $excerpt
 * @property string $body
 * @property string $status
 * @property int $category_id
 * @property int|null $author_id
 * @property bool $is_featured
 * @property bool $is_flash
 * @property bool $is_visible
 * @property int $views_count
 * @property int|null $reading_minutes
 * @property string|null $seo_title
 * @property string|null $seo_description
 * @property Carbon|null $published_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['category_id', 'title', 'slug', 'excerpt', 'body', 'reading_minutes', 'seo_title', 'seo_description'];

    protected $hidden = ['search_vector'];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'is_featured' => 'boolean',
            'is_flash' => 'boolean',
            'is_visible' => 'boolean',
            'views_count' => 'integer',
        ];
    }

    /**
     * @param  Builder<Post>  $query
     * @return Builder<Post>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('posts.is_visible', true)
            ->where('posts.status', 'published')
            ->where('posts.published_at', '<=', now());
    }

    /** @return BelongsTo<PostCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(PostCategory::class, 'category_id');
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** @return MorphOne<Media, $this> */
    public function cover(): MorphOne
    {
        return $this->morphOne(Media::class, 'mediable')->where('collection', 'cover');
    }

    /** @return HasMany<PostComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }
}
