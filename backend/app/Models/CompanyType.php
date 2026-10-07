<?php

namespace App\Models;

use Database\Factories\CompanyTypeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CompanyType extends ReferenceModel
{
    /** @use HasFactory<CompanyTypeFactory> */
    use HasFactory;

    protected $table = 'company_types';
}
