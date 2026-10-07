<?php

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\ProcedureType;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Models\StateForceType;

it('renvoie les référentiels visibles avec les quartiers', function () {
    $city = City::factory()->create(['name' => 'Abidjan', 'slug' => 'abidjan', 'latitude' => 5.36, 'longitude' => -4.0083]);
    $commune = District::factory()->create(['city_id' => $city->id, 'name' => 'Cocody', 'slug' => 'cocody']);
    $quartier = District::factory()->create(['city_id' => $city->id, 'name' => 'Angré', 'slug' => 'angre', 'parent_id' => $commune->id]);
    District::factory()->create(['city_id' => $city->id, 'is_visible' => false]);
    City::factory()->create(['is_visible' => false]);
    CompanyType::factory()->create(['is_visible' => false]);
    $service = ServiceType::factory()->create();
    StateForceType::factory()->create();
    ProcedureType::factory()->create();

    $r = $this->getJson('/api/v1/reference-data')->assertOk();
    $d = $r->json('data');

    expect(array_keys($d))->toBe(['cities', 'company_types', 'service_types', 'state_force_types', 'procedure_types']);
    expect($d['cities'])->toHaveCount(1);
    expect(array_keys($d['cities'][0]))->toBe(['id', 'name', 'slug', 'lat', 'lng', 'districts']);
    expect($d['cities'][0]['lat'])->toBe(5.36);
    expect($d['cities'][0]['districts'])->toHaveCount(2);
    expect(collect($d['cities'][0]['districts'])->firstWhere('slug', 'angre'))->toBe(['id' => $quartier->id, 'name' => 'Angré', 'slug' => 'angre', 'parent_id' => $commune->id]);
    expect($d['company_types'])->toBe([]);
    expect($d['service_types'][0])->toBe(['id' => $service->id, 'slug' => $service->slug, 'name' => $service->name]);
    expect($r->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=300');
});

it('renvoie les statistiques et au plus 8 prestataires populaires publiés', function () {
    $city = City::factory()->create();
    Provider::factory()->count(10)->create(['city_id' => $city->id]);
    Provider::factory()->pending()->create(['city_id' => $city->id]);
    StateForce::factory()->count(2)->create(['city_id' => $city->id]);
    StateForce::factory()->pending()->create(['city_id' => $city->id]);
    ServiceType::factory()->count(3)->create();
    ServiceType::factory()->create(['is_visible' => false]);

    $d = $this->getJson('/api/v1/home')->assertOk()->json('data');

    expect($d['stats'])->toBe(['providers' => 10, 'state_forces' => 2, 'service_types' => 3]);
    expect($d['popular_providers'])->toHaveCount(8);
    expect(array_keys($d['popular_providers'][0]))->toEqualCanonicalizing(SUMMARY_KEYS);
});

it('accueil vide sans erreur', function () {
    $this->getJson('/api/v1/home')->assertOk()->assertJsonPath('data.popular_providers', []);
});
