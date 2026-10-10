<?php

namespace App\Models;

use Database\Factories\ContactMessageFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $created_at
 * @property Carbon|null $handled_at
 */
class ContactMessage extends Model
{
    /** @use HasFactory<ContactMessageFactory> */
    use HasFactory;

    protected $fillable = ['name', 'email', 'subject', 'message'];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['consent_at' => 'datetime', 'handled_at' => 'datetime'];
    }
}
