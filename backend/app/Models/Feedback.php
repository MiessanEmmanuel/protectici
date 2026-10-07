<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** « Dis-moi tout » : données personnelles privées, jamais exposées par l'API publique. */
class Feedback extends Model
{
    use SoftDeletes;

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

    /** @return HasMany<FeedbackReply, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class);
    }
}
