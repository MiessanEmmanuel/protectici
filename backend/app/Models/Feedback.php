<?php

namespace App\Models;

use Database\Factories\FeedbackFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * « Dis-moi tout » : données personnelles privées, jamais exposées par l'API publique.
 *
 * @property Carbon|null $created_at
 * @property Carbon|null $consent_at
 * @property Carbon|null $resolved_at
 */
class Feedback extends Model
{
    /** @use HasFactory<FeedbackFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'feedbacks';

    protected $fillable = [
        'civility', 'last_name', 'first_name', 'email', 'phone', 'provider_id', 'action_type', 'target_type',
        'service_type_id', 'topic_id', 'product_type', 'location', 'comment',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['consent_at' => 'datetime', 'resolved_at' => 'datetime'];
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    /** @return BelongsTo<ServiceType, $this> */
    public function serviceType(): BelongsTo
    {
        return $this->belongsTo(ServiceType::class);
    }

    /** @return BelongsTo<FeedbackTopic, $this> */
    public function topic(): BelongsTo
    {
        return $this->belongsTo(FeedbackTopic::class, 'topic_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** @return HasMany<FeedbackReply, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class);
    }
}
