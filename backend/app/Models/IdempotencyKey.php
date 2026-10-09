<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Clé d'idempotence d'un formulaire (security.md §15) : 2 envois avec la même clé = une seule ressource. */
class IdempotencyKey extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'scope', 'key', 'request_hash', 'resource_type', 'resource_id'];
}
