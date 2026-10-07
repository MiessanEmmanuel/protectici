<?php

namespace App\Models;

use Database\Factories\FeedbackTopicFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FeedbackTopic extends ReferenceModel
{
    /** @use HasFactory<FeedbackTopicFactory> */
    use HasFactory;

    protected $table = 'feedback_topics';
}
