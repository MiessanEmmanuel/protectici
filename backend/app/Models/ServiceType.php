<?php

namespace App\Models;

use Database\Factories\ServiceTypeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ServiceType extends ReferenceModel
{
    /** @use HasFactory<ServiceTypeFactory> */
    use HasFactory;

    protected $table = 'service_types';

    protected $fillable = ['slug', 'name', 'description', 'icon', 'sort_order'];
}
