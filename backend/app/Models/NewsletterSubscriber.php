<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    protected $fillable = ['email', 'source'];

    protected $hidden = ['confirmation_token_hash', 'ip_hash'];

    protected function casts(): array
    {
        return ['confirmed_at' => 'datetime', 'unsubscribed_at' => 'datetime', 'consent_at' => 'datetime'];
    }
}
