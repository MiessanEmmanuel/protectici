<?php

use App\Models\City;
use App\Models\District;
use App\Models\ProcedureType;
use App\Models\StateForce;
use App\Models\StateForceType;
use Illuminate\Support\Facades\DB;

const FORCE_KEYS = ['slug', 'name', 'force_type', 'phone', 'emergency_phone', 'city', 'district', 'address', 'is_open_24h', 'lat', 'lng', 'distance_m'];

it('liste les forces étatiques publiées au format du contrat', function () {
    $type = StateForceType::factory()->create(['slug' => 'police', 'name' => 'Police']);
    $f = makeStateForce(['force_type_id' => $type->id]);

    $r = $this->getJson('/api/v1/state-forces')->assertOk();

    expect(array_keys($r->json('data.0')))->toEqualCanonicalizing(FORCE_KEYS);
    expect($r->json('data.0.force_type'))->toBe(['id' => $type->id, 'slug' => 'police', 'name' => 'Police']);
    expect($r->json('meta.total'))->toBe(1)->and($r->json('data.0.slug'))->toBe($f->slug);
});

it('n\'expose pas les fiches non publiées', function () {
    $city = City::factory()->create();
    $ok = makeStateForce([], $city);
    $pending = StateForce::factory()->pending()->create(['city_id' => $city->id]);
    $hidden = StateForce::factory()->hidden()->create(['city_id' => $city->id]);
    $deleted = makeStateForce([], $city);
    $deleted->delete();

    expect(collect($this->getJson('/api/v1/state-forces')->json('data'))->pluck('slug')->all())->toBe([$ok->slug]);
    foreach ([$pending, $hidden, $deleted] as $f) {
        $this->getJson('/api/v1/state-forces/'.$f->slug)->assertNotFound();
    }
});

it('filtre par type de force, démarche, ville et quartier', function () {
    $abidjan = City::factory()->create(['slug' => 'abidjan']);
    $bouake = City::factory()->create(['slug' => 'bouake']);
    $cocody = District::factory()->create(['city_id' => $abidjan->id, 'slug' => 'cocody']);
    $police = StateForceType::factory()->create(['slug' => 'police']);
    $gendarmerie = StateForceType::factory()->create(['slug' => 'gendarmerie']);
    $plainte = ProcedureType::factory()->create(['slug' => 'plainte']);

    $a = makeStateForce(['force_type_id' => $police->id, 'district_id' => $cocody->id], $abidjan);
    $a->procedureTypes()->attach($plainte, ['notes' => null]);
    $b = makeStateForce(['force_type_id' => $gendarmerie->id], $abidjan);
    $c = makeStateForce(['force_type_id' => $police->id], $bouake);

    $get = fn (string $qs) => collect($this->getJson('/api/v1/state-forces?'.$qs)->assertOk()->json('data'))->pluck('slug')->sort()->values()->all();

    expect($get('filter[type]=gendarmerie'))->toBe([$b->slug]);
    expect($get('filter[type]=police,gendarmerie'))->toBe(collect([$a->slug, $b->slug, $c->slug])->sort()->values()->all());
    expect($get('filter[procedure]=plainte'))->toBe([$a->slug]);
    expect($get('filter[city]=bouake'))->toBe([$c->slug]);
    expect($get('filter[district]=cocody'))->toBe([$a->slug]);
});

it('recherche par proximité triée par distance', function () {
    $city = City::factory()->create();
    $far = makeStateForce(['latitude' => 5.40, 'longitude' => -3.95], $city);
    $near = makeStateForce(['latitude' => 5.3207, 'longitude' => -4.0267], $city);
    makeStateForce(['latitude' => 5.3197, 'longitude' => -4.0267, 'is_visible' => false], $city);

    $r = $this->getJson('/api/v1/state-forces?lat=5.3197&lng=-4.0267&radius_km=20&sort=distance')->assertOk();

    expect(collect($r->json('data'))->pluck('slug')->all())->toBe([$near->slug, $far->slug]);
    expect($r->json('data.0.distance_m'))->toBeInt()->toBeLessThan(150);
});

it('fn_state_forces_nearby filtre par type de force', function () {
    $city = City::factory()->create();
    $police = StateForceType::factory()->create();
    $other = StateForceType::factory()->create();
    makeStateForce(['force_type_id' => $police->id, 'latitude' => 5.3207, 'longitude' => -4.0267], $city);
    makeStateForce(['force_type_id' => $other->id, 'latitude' => 5.3208, 'longitude' => -4.0267], $city);

    $rows = DB::select('select * from fn_state_forces_nearby(?, ?, ?, ?, ?, ?)', [5.3197, -4.0267, 5000, 10, $police->id, null]);
    expect($rows)->toHaveCount(1);
});

it('renvoie la fiche détaillée avec démarches et notes', function () {
    $f = makeStateForce(['email' => 'poste@example.test', 'opening_hours' => ['mon' => [['08:00', '17:00']]], 'is_open_24h' => false]);
    $f->procedureTypes()->attach(ProcedureType::factory()->create(['slug' => 'perte', 'name' => 'Déclaration de perte']), ['notes' => 'Pièce d\'identité']);

    $d = $this->getJson('/api/v1/state-forces/'.$f->slug)->assertOk()->json('data');

    expect(array_keys($d))->toEqualCanonicalizing([...FORCE_KEYS, 'description', 'email', 'geo_description', 'plus_code', 'opening_hours', 'procedures']);
    expect($d['procedures'])->toBe([['slug' => 'perte', 'name' => 'Déclaration de perte', 'notes' => 'Pièce d\'identité']]);
    expect($d['opening_hours'])->toBe(['mon' => [['08:00', '17:00']]]);
});

it('valide les paramètres des forces étatiques', function (string $qs, string $field) {
    $this->getJson('/api/v1/state-forces?'.$qs)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    'tri interdit pour les forces' => ['sort=-rating', 'sort'],
    'type invalide' => ['filter[type]=Police Nationale', 'filter.type'],
    'lng sans lat' => ['lng=-4', 'lat'],
    'rayon trop grand' => ['lat=5&lng=-4&radius_km=51', 'radius_km'],
]);

it('plafonne per_page à 50 et refuse 404 sur slug inconnu', function () {
    expect($this->getJson('/api/v1/state-forces?per_page=100')->json('meta.per_page'))->toBe(50);
    $this->getJson('/api/v1/state-forces/inconnu')->assertNotFound();
});
