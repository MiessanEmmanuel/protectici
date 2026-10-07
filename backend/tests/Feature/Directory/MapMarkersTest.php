<?php

use App\Models\City;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Models\StateForceType;

it('renvoie les marqueurs des prestataires publiés', function () {
    $city = City::factory()->create();
    $p = makeProvider(['latitude' => 5.32, 'longitude' => -4.02], $city);
    makeProvider(['latitude' => 5.33, 'longitude' => -4.02, 'is_visible' => false], $city);
    makeProvider(['latitude' => null, 'longitude' => null], $city);

    $r = $this->getJson('/api/v1/map/markers?type=providers')->assertOk();

    expect($r->json('data'))->toBe([['slug' => $p->slug, 'name' => $p->name, 'lat' => 5.32, 'lng' => -4.02]]);
});

it('applique la bbox minLng,minLat,maxLng,maxLat', function () {
    $city = City::factory()->create();
    $in = makeProvider(['latitude' => 5.32, 'longitude' => -4.02], $city);
    makeProvider(['latitude' => 7.69, 'longitude' => -5.03], $city);

    $r = $this->getJson('/api/v1/map/markers?type=providers&bbox=-4.2,5.2,-3.8,5.5')->assertOk();

    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$in->slug]);
});

it('supporte type (cible) distinct de filter[type] (type de force) pour les forces étatiques', function () {
    $city = City::factory()->create();
    $police = StateForceType::factory()->create(['slug' => 'police']);
    $gendarmerie = StateForceType::factory()->create(['slug' => 'gendarmerie']);
    $a = makeStateForce(['force_type_id' => $police->id], $city);
    makeStateForce(['force_type_id' => $gendarmerie->id], $city);

    $r = $this->getJson('/api/v1/map/markers?type=state_forces&filter[type]=police')->assertOk();

    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$a->slug]);
});

it('applique les mêmes filtres que les listes pour les prestataires', function () {
    $city = City::factory()->create();
    $service = ServiceType::factory()->create(['slug' => 'escorte']);
    $a = makeProvider([], $city);
    $a->serviceTypes()->attach($service);
    makeProvider([], $city);

    $r = $this->getJson('/api/v1/map/markers?type=providers&filter[service]=escorte')->assertOk();
    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$a->slug]);
});

it('borne le résultat à 500 marqueurs', function () {
    $city = City::factory()->create();
    Provider::factory()->count(503)->create(['city_id' => $city->id]);

    expect($this->getJson('/api/v1/map/markers?type=providers')->assertOk()->json('data'))->toHaveCount(500);
});

it('valide type et bbox', function (string $qs, string $field) {
    $this->getJson('/api/v1/map/markers?'.$qs)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    'type absent' => ['', 'type'],
    'type inconnu' => ['type=posts', 'type'],
    'bbox malformée' => ['type=providers&bbox=a,b,c,d', 'bbox'],
    'bbox incomplète' => ['type=providers&bbox=1,2,3', 'bbox'],
    'bbox inversée' => ['type=providers&bbox=-3,5,-4,6', 'bbox'],
    'bbox hors globe' => ['type=providers&bbox=-300,5,-4,6', 'bbox'],
]);
