<?php

namespace App\Models;

use Database\Factories\ReviewFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Avis : compte requis, un par utilisateur et par prestataire, modéré avant affichage (RG3).
 * `user_id`, `status`, `is_visible`, `moderated_*` ne sont jamais assignables en masse.
 *
 * @property int $id
 * @property int $provider_id
 * @property int|null $user_id
 * @property string $status
 * @property bool $is_visible
 * @property Carbon|null $deleted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $provider_replied_at
 */
class Review extends Model
{
    /** @use HasFactory<ReviewFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['rating', 'title', 'body'];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_visible' => 'boolean',
            'moderated_at' => 'datetime',
            'provider_replied_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<Review>  $query
     * @return Builder<Review>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('reviews.is_visible', true)->where('reviews.status', 'approved');
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<ReviewReport, $this> */
    public function reports(): HasMany
    {
        return $this->hasMany(ReviewReport::class);
    }
}
