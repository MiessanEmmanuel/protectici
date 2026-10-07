<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuoteRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'last_name', 'first_name', 'email', 'phone', 'company_name', 'service_type_id', 'city_id',
        'district_id', 'description', 'desired_start_date', 'budget_range',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['desired_start_date' => 'date', 'consent_at' => 'datetime'];
    }

    /** @return HasMany<QuoteRequestRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(QuoteRequestRecipient::class);
    }
}
