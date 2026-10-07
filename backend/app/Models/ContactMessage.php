<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $fillable = ['name', 'email', 'subject', 'message'];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['consent_at' => 'datetime', 'handled_at' => 'datetime'];
    }
}
