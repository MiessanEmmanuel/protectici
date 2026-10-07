<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackReply extends Model
{
    protected $fillable = ['feedback_id', 'body', 'is_internal'];

    protected function casts(): array
    {
        return ['is_internal' => 'boolean', 'sent_at' => 'datetime'];
    }

    /** @return BelongsTo<Feedback, $this> */
    public function feedback(): BelongsTo
    {
        return $this->belongsTo(Feedback::class);
    }
}
