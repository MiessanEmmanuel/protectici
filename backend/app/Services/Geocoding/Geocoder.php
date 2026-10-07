<?php

namespace App\Services\Geocoding;

interface Geocoder
{
    /**
     * @return list<array{label: string, lat: float, lng: float}>
     *
     * @throws GeocodingUnavailableException
     */
    public function search(string $query): array;
}
