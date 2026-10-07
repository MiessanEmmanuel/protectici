<?php

namespace Tests\Support;

use App\Services\Geocoding\Geocoder;
use App\Services\Geocoding\GeocodingUnavailableException;

/** Géocodeur factice : aucun appel réseau dans les tests. */
class FakeGeocoder implements Geocoder
{
    /** @var list<string> */
    public array $queries = [];

    public bool $fail = false;

    public function search(string $query): array
    {
        $this->queries[] = $query;

        if ($this->fail) {
            throw new GeocodingUnavailableException('indisponible');
        }

        return [
            ['label' => 'Cocody, Abidjan, Côte d\'Ivoire', 'lat' => 5.36, 'lng' => -3.99],
            ['label' => 'Plateau, Abidjan, Côte d\'Ivoire', 'lat' => 5.3197, 'lng' => -4.0267],
        ];
    }
}
