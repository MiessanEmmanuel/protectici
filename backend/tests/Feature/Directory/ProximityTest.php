<?php

use App\Models\City;
use Illuminate\Support\Facades\DB;

// Plateau (centre) ; Cocody ~5 km ; Yopougon ~8 km ; Bouaké ~280 km.
const PLATEAU = [5.3197, -4.0267];

it('trie les prestataires par distance croissante en mètres', function () {
    $city = City::factory()->create();
    $far = makeProvider(['name' => 'Loin'], $city);
    $far->forceFill(['latitude' => 5.40, 'longitude' => -3.95])->save();
    $near = makeProvider(['name' => 'Proche'], $city);
    $near->forceFill(['latitude' => 5.3207, 'longitude' => -4.0267])->save(); // ~111 m
    $mid = makeProvider(['name' => 'Moyen'], $city);
    $mid->forceFill(['latitude' => 5.35, 'longitude' => -4.0267])->save();    // ~3,4 km

    $r = $this->getJson('/api/v1/providers?lat='.PLATEAU[0].'&lng='.PLATEAU[1].'&radius_km=20&sort=distance')->assertOk();

    expect(collect($r->json('data'))->pluck('name')->all())->toBe(['Proche', 'Moyen', 'Loin']);
    $d = collect($r->json('data'))->pluck('distance_m')->all();
    expect($d[0])->toBeGreaterThan(100)->toBeLessThan(125);
    expect($d[1])->toBeGreaterThan(3300)->toBeLessThan(3500);
    expect($d)->toBe(collect($d)->sort()->values()->all());
    expect($d[0])->toBeInt();
});

it('respecte le rayon et exclut les fiches non publiées ou sans coordonnées', function () {
    $city = City::factory()->create();
    $in = makeProvider(['name' => 'Dans le rayon', 'latitude' => 5.3207, 'longitude' => -4.0267], $city);
    makeProvider(['name' => 'Hors rayon', 'latitude' => 5.50, 'longitude' => -3.80], $city);
    makeProvider(['name' => 'Masquée', 'latitude' => 5.3208, 'longitude' => -4.0267, 'is_visible' => false], $city);
    makeProvider(['name' => 'En attente', 'latitude' => 5.3209, 'longitude' => -4.0267, 'status' => 'pending', 'is_visible' => false], $city);
    $deleted = makeProvider(['name' => 'Supprimée', 'latitude' => 5.3210, 'longitude' => -4.0267], $city);
    $deleted->delete();
    makeProvider(['name' => 'Sans GPS', 'latitude' => null, 'longitude' => null], $city);

    $r = $this->getJson('/api/v1/providers?lat='.PLATEAU[0].'&lng='.PLATEAU[1].'&radius_km=5')->assertOk();

    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$in->slug]);
});

it('combine proximité et filtres', function () {
    $city = City::factory()->create();
    $a = makeProvider(['name' => 'Alpha Proche', 'latitude' => 5.3207, 'longitude' => -4.0267], $city);
    makeProvider(['name' => 'Bravo Proche', 'latitude' => 5.3208, 'longitude' => -4.0267], $city);

    $r = $this->getJson('/api/v1/providers?'.http_build_query(['lat' => PLATEAU[0], 'lng' => PLATEAU[1], 'filter' => ['q' => 'alpha']]))->assertOk();
    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$a->slug]);
});

it('utilise un rayon de 50 km par défaut et le plan d\'exécution reste valide', function () {
    $city = City::factory()->create();
    makeProvider(['latitude' => 5.40, 'longitude' => -3.95], $city);
    makeProvider(['latitude' => 7.69, 'longitude' => -5.03], $city); // Bouaké

    expect($this->getJson('/api/v1/providers?lat='.PLATEAU[0].'&lng='.PLATEAU[1])->assertOk()->json('meta.total'))->toBe(1);
});

it('fn_providers_nearby ne retourne que des fiches publiques triées par distance', function () {
    $city = City::factory()->create();
    makeProvider(['latitude' => 5.3207, 'longitude' => -4.0267], $city);
    makeProvider(['latitude' => 5.3197, 'longitude' => -4.0287], $city);
    makeProvider(['latitude' => 5.3200, 'longitude' => -4.0270, 'is_visible' => false], $city);

    $rows = DB::select('select * from fn_providers_nearby(?, ?, ?, ?)', [5.3197, -4.0267, 5000, 10]);

    expect($rows)->toHaveCount(2);
    expect($rows[0]->distance_m)->toBeLessThan($rows[1]->distance_m);
});
