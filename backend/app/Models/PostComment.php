<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $post_id
 * @property int|null $user_id
 * @property int|null $parent_id
 * @property string $body
 * @property string $status
 * @property bool $is_visible
 * @property Carbon|null $moderated_at
 * @property Carbon|null $created_at
 */
class PostComment extends Model
{
    use SoftDeletes;

    protected $fillable = ['post_id', 'parent_id', 'body'];

    protected function casts(): array
    {
        return ['is_visible' => 'boolean', 'moderated_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PostComment, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /** @return BelongsTo<Post, $this> */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
