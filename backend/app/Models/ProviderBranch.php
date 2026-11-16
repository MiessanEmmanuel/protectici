<?php

namespace App\Models;

use Database\Factories\ProviderBranchFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Agence (adresse secondaire) d'un prestataire. L'adresse de la fiche prestataire reste le siège.
 * location : colonne générée (lecture seule), jamais assignable.
 *
 * @property int $id
 * @property int $provider_id
 * @property string $label
 * @property int $city_id
 * @property int|null $district_id
 * @property string|null $address
 * @property string|null $geo_description
 * @property string|null $phone
 * @property string|null $latitude
 * @property string|null $longitude
 * @property int $sort_order
 */
class ProviderBranch extends Model
{
    /** @use HasFactory<ProviderBranchFactory> */
    use HasFactory;

    protected $fillable = [
        'provider_id', 'label', 'city_id', 'district_id', 'address', 'geo_description', 'phone',
        'latitude', 'longitude', 'sort_order',
    ];

    protected $hidden = ['location'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
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
}
