<?php

namespace App\Models;

use Database\Factories\StateForceTypeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StateForceType extends ReferenceModel
{
    /** @use HasFactory<StateForceTypeFactory> */
    use HasFactory;

    protected $table = 'state_force_types';
}
