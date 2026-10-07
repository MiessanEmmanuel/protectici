<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConsentLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'email', 'purpose', 'policy_version', 'granted', 'ip_hash'];

    protected function casts(): array
    {
        return ['granted' => 'boolean'];
    }
}
