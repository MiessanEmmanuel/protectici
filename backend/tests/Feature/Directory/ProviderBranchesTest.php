<?php

use App\Models\City;
use App\Models\ProviderBranch;

it('expose les agences sur la fiche publique', function () {
    $city = City::factory()->create();
    $p = makeProvider([], $city);
    ProviderBranch::factory()->at(5.35, -4.01)->create(['provider_id' => $p->id, 'city_id' => $city->id, 'label' => 'Agence de Cocody', 'phone' => '+2250700000001']);
    ProviderBranch::factory()->withoutCoordinates()->create(['provider_id' => $p->id, 'city_id' => $city->id, 'label' => 'Agence de Yopougon', 'sort_order' => 1]);

    $d = $this->getJson('/api/v1/providers/'.$p->slug)->assertOk()->json('data');

    expect($d['branches_count'])->toBe(2)->and($d['branches'])->toHaveCount(2);
    expect(array_keys($d['branches'][0]))->toBe(['id', 'label', 'city', 'district', 'address', 'geo_description', 'phone', 'lat', 'lng']);
    expect($d['branches'][0]['label'])->toBe('Agence de Cocody')
        ->and($d['branches'][0]['city'])->toBe(['name' => $city->name, 'slug' => $city->slug])
        ->and($d['branches'][0]['lat'])->toBe(5.35)
        ->and($d['branches'][1]['lat'])->toBeNull();
});

it('compte les agences dans les listes sans requête par ligne', function () {
    $city = City::factory()->create();
    $p = makeProvider([], $city);
    ProviderBranch::factory()->count(2)->create(['provider_id' => $p->id, 'city_id' => $city->id]);

    $r = $this->getJson('/api/v1/providers')->assertOk();

    expect($r->json('data.0.branches_count'))->toBe(2)->and($r->json('data.0.nearest_branch'))->toBeNull();
});

it('indique l\'agence la plus proche quand elle bat le siège', function () {
    $city = City::factory()->create();
    $p = makeProvider(['latitude' => 7.69, 'longitude' => -5.03], $city);
    $b = ProviderBranch::factory()->at(5.35, -4.01)->create(['provider_id' => $p->id, 'city_id' => $city->id, 'label' => 'Agence de Cocody']);

    $r = $this->getJson('/api/v1/providers?lat=5.35&lng=-4.01&radius_km=10')->assertOk();

    expect($r->json('data.0.slug'))->toBe($p->slug)
        ->and($r->json('data.0.nearest_branch'))->toBe(['id' => $b->id, 'label' => 'Agence de Cocody'])
        ->and($r->json('data.0.distance_m'))->toBe(0);
});

it('garde nearest_branch à null quand le siège est le plus proche', function () {
    $city = City::factory()->create();
    $p = makeProvider(['latitude' => 5.35, 'longitude' => -4.01], $city);
    ProviderBranch::factory()->at(5.40, -4.05)->create(['provider_id' => $p->id, 'city_id' => $city->id]);

    $r = $this->getJson('/api/v1/providers?lat=5.35&lng=-4.01&radius_km=20')->assertOk();

    expect($r->json('data.0.nearest_branch'))->toBeNull();
});

it('renvoie un marqueur par agence géolocalisée, même si le siège ne l\'est pas', function () {
    $city = City::factory()->create();
    $withHead = makeProvider(['latitude' => 5.32, 'longitude' => -4.02], $city);
    ProviderBranch::factory()->at(5.35, -4.01)->create(['provider_id' => $withHead->id, 'city_id' => $city->id, 'label' => 'Agence A']);
    ProviderBranch::factory()->withoutCoordinates()->create(['provider_id' => $withHead->id, 'city_id' => $city->id]);
    $noHead = makeProvider(['latitude' => null, 'longitude' => null], $city);
    ProviderBranch::factory()->at(5.36, -4.03)->create(['provider_id' => $noHead->id, 'city_id' => $city->id, 'label' => 'Agence B']);
    $hidden = makeProvider(['latitude' => null, 'longitude' => null, 'is_visible' => false], $city);
    ProviderBranch::factory()->at(5.37, -4.00)->create(['provider_id' => $hidden->id, 'city_id' => $city->id, 'label' => 'Agence cachée']);

    $data = $this->getJson('/api/v1/map/markers?type=providers')->assertOk()->json('data');

    expect($data)->toBe([
        ['slug' => $withHead->slug, 'name' => $withHead->name, 'branch_label' => null, 'lat' => 5.32, 'lng' => -4.02],
        ['slug' => $withHead->slug, 'name' => $withHead->name, 'branch_label' => 'Agence A', 'lat' => 5.35, 'lng' => -4.01],
        ['slug' => $noHead->slug, 'name' => $noHead->name, 'branch_label' => 'Agence B', 'lat' => 5.36, 'lng' => -4.03],
    ]);
});

it('applique la bbox sur la position de l\'agence', function () {
    $city = City::factory()->create();
    $p = makeProvider(['latitude' => 7.69, 'longitude' => -5.03], $city);
    ProviderBranch::factory()->at(5.35, -4.01)->create(['provider_id' => $p->id, 'city_id' => $city->id, 'label' => 'Agence A']);

    $data = $this->getJson('/api/v1/map/markers?type=providers&bbox=-4.2,5.2,-3.8,5.5')->assertOk()->json('data');

    expect($data)->toHaveCount(1)->and($data[0]['branch_label'])->toBe('Agence A');
});

it('rafraîchit la réponse publique après un changement d\'agence', function () {
    config()->set('cache.public.enabled', true);
    $city = City::factory()->create();
    $p = makeProvider([], $city);

    expect($this->getJson('/api/v1/providers/'.$p->slug)->json('data.branches'))->toBe([]);

    ProviderBranch::factory()->create(['provider_id' => $p->id, 'city_id' => $city->id]);

    expect($this->getJson('/api/v1/providers/'.$p->slug)->json('data.branches'))->toHaveCount(1);
});
