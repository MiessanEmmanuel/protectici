<?php

namespace App\Models;

use Database\Factories\ProcedureTypeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProcedureType extends ReferenceModel
{
    /** @use HasFactory<ProcedureTypeFactory> */
    use HasFactory;

    protected $table = 'procedure_types';
}
