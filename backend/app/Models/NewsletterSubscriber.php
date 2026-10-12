<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $email
 * @property string $status
 * @property string|null $source
 * @property string|null $confirmation_token_hash
 * @property string|null $resend_contact_id
 * @property Carbon|null $consent_at
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $unsubscribed_at
 * @property Carbon|null $created_at
 */
class NewsletterSubscriber extends Model
{
    protected $fillable = ['email', 'source'];

    protected $hidden = ['confirmation_token_hash', 'ip_hash'];

    protected function casts(): array
    {
        return ['confirmed_at' => 'datetime', 'unsubscribed_at' => 'datetime', 'consent_at' => 'datetime'];
    }
}
