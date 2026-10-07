<?php

namespace App\Models;

use Database\Factories\ProviderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Fiche prestataire. Champs sensibles (RG2) : modifiés uniquement via provider_change_requests ou par un admin.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $status
 * @property bool $is_visible
 * @property Carbon|null $deleted_at
 * @property string|null $latitude
 * @property string|null $longitude
 */
class Provider extends Model
{
    /** @use HasFactory<ProviderFactory> */
    use HasFactory, SoftDeletes;

    /** Champs non sensibles, modifiables par le propriétaire de la fiche. */
    protected $fillable = [
        'name', 'description', 'price_from', 'phone', 'phone_alt', 'emergency_phone', 'email',
        'website_url', 'facebook_url', 'instagram_url', 'twitter_url', 'linkedin_url', 'whatsapp_number',
        'address', 'city_id', 'district_id', 'geo_description', 'plus_code', 'latitude', 'longitude',
        'is_in_service',
    ];

    /** Champs soumis à validation admin (RG2) : jamais assignables en masse. */
    public const SENSITIVE_FIELDS = [
        'name', 'rccm', 'approval_number', 'legal_form', 'share_capital', 'corporate_purpose',
    ];

    protected $hidden = ['location', 'search_vector'];

    protected function casts(): array
    {
        return [
            'price_from' => 'integer',
            'share_capital' => 'integer',
            'is_in_service' => 'boolean',
            'is_verified' => 'boolean',
            'is_featured' => 'boolean',
            'is_visible' => 'boolean',
            'views_count' => 'integer',
            'rating_count' => 'integer',
            'rating_avg' => 'float',
            'approval_expires_at' => 'date',
            'reviewed_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    /**
     * Fiche exposée publiquement : visible ET approuvée (la suppression logique est exclue par SoftDeletes).
     *
     * @param  Builder<Provider>  $query
     * @return Builder<Provider>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('providers.is_visible', true)->where('providers.status', 'approved');
    }

    /**
     * Prestataires dans un rayon (mètres) via fn_providers_nearby (ST_DWithin + tri KNN) ;
     * ajoute la colonne distance_m et joint uniquement les fiches publiques.
     *
     * @param  Builder<Provider>  $query
     * @return Builder<Provider>
     */
    public function scopeNear(Builder $query, float $lat, float $lng, int $radiusMeters, int $limit = 5000): Builder
    {
        $nearby = DB::query()
            ->fromRaw('fn_providers_nearby(?::double precision, ?::double precision, ?::integer, ?::integer)', [$lat, $lng, $radiusMeters, $limit])
            ->select('id', 'distance_m');

        return $query
            ->joinSub($nearby, 'nearby', 'nearby.id', '=', 'providers.id')
            ->addSelect('providers.*', 'nearby.distance_m');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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

    /** @return BelongsToMany<CompanyType, $this> */
    public function companyTypes(): BelongsToMany
    {
        return $this->belongsToMany(CompanyType::class, 'provider_company_type');
    }

    /** @return BelongsToMany<ServiceType, $this> */
    public function serviceTypes(): BelongsToMany
    {
        return $this->belongsToMany(ServiceType::class, 'provider_service_type');
    }

    /** @return HasMany<ProviderExecutive, $this> */
    public function executives(): HasMany
    {
        return $this->hasMany(ProviderExecutive::class)->orderBy('sort_order');
    }

    /** @return HasMany<ProviderDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(ProviderDocument::class);
    }

    /** @return HasMany<ProviderChangeRequest, $this> */
    public function changeRequests(): HasMany
    {
        return $this->hasMany(ProviderChangeRequest::class);
    }

    /** @return HasMany<Review, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    /** @return BelongsToMany<User, $this> */
    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'favorites');
    }

    /** @return MorphMany<Media, $this> */
    public function media(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable')->orderBy('sort_order');
    }

    /** @return MorphOne<Media, $this> */
    public function logo(): MorphOne
    {
        return $this->morphOne(Media::class, 'mediable')->where('collection', 'logo');
    }

    /** @return MorphMany<Media, $this> */
    public function gallery(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable')->where('collection', 'gallery')->orderBy('sort_order');
    }
}
