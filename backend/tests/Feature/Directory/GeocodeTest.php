<?php

use App\Services\Geocoding\Geocoder;
use App\Services\Geocoding\GeocodingUnavailableException;
use App\Services\Geocoding\NominatimGeocoder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeGeocoder;

beforeEach(function () {
    $this->geocoder = new FakeGeocoder;
    $this->app->instance(Geocoder::class, $this->geocoder);
});

it('géocode une adresse', function () {
    $r = $this->getJson('/api/v1/geocode?q=Cocody')->assertOk();

    expect($r->json('data.0'))->toBe(['label' => 'Cocody, Abidjan, Côte d\'Ivoire', 'lat' => 5.36, 'lng' => -3.99]);
    expect($this->geocoder->queries)->toBe(['Cocody']);
});

it('valide q (3 à 100 caractères)', function (string $qs) {
    $this->getJson('/api/v1/geocode'.$qs)->assertUnprocessable()->assertJsonValidationErrors('q');
})->with(['absent' => [''], 'trop court' => ['?q=ab'], 'trop long' => ['?q='.'a1b2c3d4e5'.'f6g7h8i9j0'.'k1l2m3n4o5'.'p6q7r8s9t0'.'u1v2w3x4y5'.'z6a7b8c9d0'.'e1f2g3h4i5'.'j6k7l8m9n0'.'o1p2q3r4s5'.'t6u7v8w9x0x']]);

it('renvoie 503 JSON quand le service est indisponible', function () {
    $this->geocoder->fail = true;

    $this->getJson('/api/v1/geocode?q=Cocody')->assertStatus(503)->assertJson(['message' => 'Le service de géocodage est momentanément indisponible.']);
});

it('limite à 30 requêtes par minute et par IP', function () {
    foreach (range(1, 30) as $i) {
        $this->getJson('/api/v1/geocode?q=Cocody')->assertOk();
    }
    $this->getJson('/api/v1/geocode?q=Cocody')->assertTooManyRequests()->assertHeader('Retry-After');
});

it('le client Nominatim s\'identifie, restreint à la Côte d\'Ivoire et met en cache', function () {
    Http::fake(['nominatim.test/*' => Http::response([
        ['display_name' => 'Cocody, Abidjan', 'lat' => '5.36', 'lon' => '-3.99'],
        ['display_name' => 'Incomplet'],
    ])]);
    $client = new NominatimGeocoder('https://nominatim.test/search', 'ProtectIci-test/1.0 (test)', 60);

    $first = $client->search('Cocody');
    $second = $client->search('cocody ');

    expect($first)->toBe([['label' => 'Cocody, Abidjan', 'lat' => 5.36, 'lng' => -3.99]]);
    expect($second)->toBe($first);
    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request->hasHeader('User-Agent', 'ProtectIci-test/1.0 (test)')
        && $request['countrycodes'] === 'ci' && $request['q'] === 'Cocody' && $request['limit'] === 5);
});

it('le client Nominatim lève une exception sans mettre l\'échec en cache', function () {
    Http::fake(['nominatim.test/*' => Http::response('erreur', 500)]);
    $client = new NominatimGeocoder('https://nominatim.test/search', 'ProtectIci-test/1.0', 60);

    expect(fn () => $client->search('Cocody'))->toThrow(GeocodingUnavailableException::class);
    expect(Cache::has('geocode:'.sha1('cocody')))->toBeFalse();
});
