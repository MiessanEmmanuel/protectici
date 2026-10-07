<?php

namespace App\Services\Geocoding;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Client Nominatim (OSM). Hôte FIXE (jamais d'URL fournie par l'utilisateur), User-Agent identifiable,
 * résultats en cache, 1 requête/seconde côté serveur (politique d'usage OSM).
 */
class NominatimGeocoder implements Geocoder
{
    public function __construct(
        private readonly string $url,
        private readonly string $userAgent,
        private readonly int $cacheTtl = 86400,
    ) {}

    public function search(string $query): array
    {
        $key = 'geocode:'.sha1(mb_strtolower(trim($query)));

        return Cache::remember($key, $this->cacheTtl, fn () => $this->fetch($query));
    }

    /** @return list<array{label: string, lat: float, lng: float}> */
    private function fetch(string $query): array
    {
        $this->waitForSlot();

        try {
            $response = Http::withUserAgent($this->userAgent)
                ->acceptJson()
                ->timeout(5)
                ->get($this->url, [
                    'q' => $query,
                    'format' => 'jsonv2',
                    'limit' => 5,
                    'countrycodes' => 'ci',
                    'accept-language' => 'fr',
                ]);
        } catch (Throwable) {
            throw new GeocodingUnavailableException('Nominatim injoignable');
        }

        if ($response->failed() || ! is_array($response->json())) {
            throw new GeocodingUnavailableException('Réponse Nominatim invalide');
        }

        $results = [];
        foreach ($response->json() as $row) {
            if (isset($row['display_name'], $row['lat'], $row['lon'])) {
                $results[] = [
                    'label' => (string) $row['display_name'],
                    'lat' => (float) $row['lat'],
                    'lng' => (float) $row['lon'],
                ];
            }
        }

        return $results;
    }

    /** Espace les appels d'au moins 1 seconde (verrou global). */
    private function waitForSlot(): void
    {
        $lock = Cache::lock('nominatim:lock', 10);

        try {
            $lock->block(6);
        } catch (LockTimeoutException) {
            throw new GeocodingUnavailableException('Limite de débit Nominatim');
        }

        try {
            $wait = 1.0 - (microtime(true) - (float) Cache::get('nominatim:last', 0));
            if ($wait > 0) {
                usleep((int) ($wait * 1_000_000));
            }
            Cache::put('nominatim:last', microtime(true), 60);
        } finally {
            $lock->release();
        }
    }
}
