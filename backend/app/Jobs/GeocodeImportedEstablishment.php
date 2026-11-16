<?php

namespace App\Jobs;

use App\Enums\EstablishmentType;
use App\Models\District;
use App\Services\Geocoding\Geocoder;
use App\Services\Geocoding\GeocodingUnavailableException;
use App\Services\Imports\ImportRowValidator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Géocodage d'une fiche importée sans coordonnées (adresse + commune + ville). Le géocodeur applique le cache et
 * la limite de 1 requête/s ; un résultat hors de Côte d'Ivoire est ignoré. Sans résultat, la fiche reste dans
 * « Fiches incomplètes » pour un pointage manuel sur la carte.
 */
class GeocodeImportedEstablishment implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public readonly string $type, public readonly int $establishmentId)
    {
        $this->afterCommit();
    }

    public function handle(Geocoder $geocoder): void
    {
        $type = EstablishmentType::tryFrom($this->type);
        $model = $type?->query()->with('city')->find($this->establishmentId);
        if ($model === null || $model->latitude !== null) {
            return;
        }

        $district = $model->district_id === null ? null : District::query()->find($model->district_id);
        $query = implode(', ', array_filter([$model->address, $district?->name, $model->city?->name]));
        if ($query === '' || ($model->address === null && $district === null)) {
            return;
        }

        try {
            $results = $geocoder->search(mb_substr($query, 0, 250));
        } catch (GeocodingUnavailableException) {
            $this->release(60);

            return;
        }

        foreach ($results as $result) {
            if ($result['lat'] >= ImportRowValidator::LAT_MIN && $result['lat'] <= ImportRowValidator::LAT_MAX
                && $result['lng'] >= ImportRowValidator::LNG_MIN && $result['lng'] <= ImportRowValidator::LNG_MAX) {
                $model->forceFill(['latitude' => round($result['lat'], 6), 'longitude' => round($result['lng'], 6)])->save();

                return;
            }
        }
    }
}
