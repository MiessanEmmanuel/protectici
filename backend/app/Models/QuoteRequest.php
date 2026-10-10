<?php

namespace App\Models;

use App\Policies\QuoteRequestPolicy;
use Database\Factories\QuoteRequestFactory;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Demande de devis. `status`, `user_id`, `consent_at`, `ip_hash` et `assigned_to` ne sont JAMAIS assignables en
 * masse : ils sont écrits par les services (création, acheminement, changement de statut).
 *
 * @property int $id
 * @property string $reference
 * @property int|null $user_id
 * @property string $first_name
 * @property string $last_name
 * @property string|null $email
 * @property string $phone
 * @property string|null $company_name
 * @property int $service_type_id
 * @property int $city_id
 * @property int|null $district_id
 * @property string $description
 * @property Carbon|null $desired_start_date
 * @property string|null $budget_range
 * @property string $status
 * @property Carbon|null $created_at
 */
#[UsePolicy(QuoteRequestPolicy::class)]
class QuoteRequest extends Model
{
    /** @use HasFactory<QuoteRequestFactory> */
    use HasFactory, SoftDeletes;

    public const STATUSES = ['new', 'sent', 'answered', 'closed', 'cancelled'];

    protected $fillable = [
        'last_name', 'first_name', 'email', 'phone', 'company_name', 'service_type_id', 'city_id',
        'district_id', 'description', 'desired_start_date', 'budget_range',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['desired_start_date' => 'date', 'consent_at' => 'datetime'];
    }

    /** Le demandeur ne peut plus recevoir de réponse : demande close ou annulée. */
    public function isOpen(): bool
    {
        return ! in_array($this->status, ['closed', 'cancelled'], true);
    }

    /** @return HasMany<QuoteRequestRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(QuoteRequestRecipient::class);
    }

    /** @return BelongsTo<ServiceType, $this> */
    public function serviceType(): BelongsTo
    {
        return $this->belongsTo(ServiceType::class);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @return BelongsTo<District, $this> */
    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
