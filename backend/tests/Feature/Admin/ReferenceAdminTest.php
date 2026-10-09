<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\PostCategory;
use App\Models\ServiceType;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

const REF = '/api/v1/admin/reference/';

it('refuse l\'accès sans droits suffisants (401 / 403)', function () {
    $type = CompanyType::factory()->create();
    $calls = [
        ['getJson', REF.'company-types', []],
        ['postJson', REF.'company-types', ['name' => 'Nouveau']],
        ['patchJson', REF.'company-types/'.$type->id, ['name' => 'Modifié']],
        ['deleteJson', REF.'company-types/'.$type->id, []],
    ];
    foreach ($calls as [$method, $url, $body]) {
        $this->{$method}($url, $body)->assertUnauthorized();
    }
    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $user) {
        foreach ($calls as [$method, $url, $body]) {
            $this->actingAs($user)->{$method}($url, $body)->assertForbidden();
        }
    }
    expect(CompanyType::query()->count())->toBe(1)->and($type->refresh()->name)->not->toBe('Modifié');
});

it('renvoie 404 pour une ressource hors liste blanche', function () {
    $this->actingAs(makeAdmin())->getJson(REF.'users')->assertNotFound();
    $this->postJson(REF.'audit_logs', ['name' => 'x'])->assertNotFound();
});

it('liste, y compris les valeurs masquées, avec recherche et pagination', function () {
    $this->actingAs(makeAdmin());
    ServiceType::factory()->create(['name' => 'Gardiennage', 'is_visible' => true]);
    ServiceType::factory()->create(['name' => 'Vidéosurveillance', 'is_visible' => false]);
    ServiceType::factory()->create(['name' => '100% sûr']);

    $json = $this->getJson(REF.'service-types')->assertOk()->json();
    expect($json['data'])->toHaveCount(3)->and($json['meta']['total'])->toBe(3);
    expect($json['data'][0])->toHaveKeys(['id', 'slug', 'name', 'description', 'sort_order', 'is_visible', 'icon']);

    $names = fn (string $qs) => collect($this->getJson(REF.'service-types?'.$qs)->assertOk()->json('data'))->pluck('name')->all();
    expect($names('q=vidéo'))->toBe(['Vidéosurveillance']);
    expect($names('q=100%25'))->toBe(['100% sûr']);
    expect($names('q=_'))->toBe([]);
    expect($this->getJson(REF.'service-types?per_page=2')->json('data'))->toHaveCount(2);
    $this->getJson(REF.'service-types?per_page=51')->assertUnprocessable();
});

it('crée une valeur : 201, slug automatique, audit, caches invalidés', function () {
    $admin = makeAdmin();
    Cache::put('reference-data:v1', ['stale' => true]);
    Cache::put('home:stats:v1', ['stale' => true]);

    $this->actingAs($admin)->postJson(REF.'service-types', [
        'name' => '  Sécurité <b>incendie</b> ', 'description' => 'Prévention', 'icon' => 'flame', 'sort_order' => 3,
        'slug' => 'impose-par-le-client', 'id' => 99, 'is_visible' => false,
    ])->assertCreated()->assertJsonPath('data.slug', 'securite-incendie')
        ->assertJsonPath('data.name', 'Sécurité incendie')->assertJsonPath('data.is_visible', false)
        ->assertJsonPath('data.icon', 'flame')->assertJsonPath('data.sort_order', 3);

    expect(ServiceType::where('slug', 'impose-par-le-client')->exists())->toBeFalse();
    expect(Cache::has('reference-data:v1'))->toBeFalse()->and(Cache::has('home:stats:v1'))->toBeFalse();

    $log = AuditLog::where('event', 'reference_created')->sole();
    expect($log->user_id)->toBe($admin->id)
        ->and($log->context)->toMatchArray(['resource' => 'service-types', 'name' => 'Sécurité incendie']);
});

it('crée une valeur visible par défaut et ignore l\'icône sur les autres ressources', function () {
    $this->actingAs(makeAdmin());
    $this->postJson(REF.'company-types', ['name' => 'Association', 'icon' => 'x'])
        ->assertCreated()->assertJsonPath('data.is_visible', true)->assertJsonMissingPath('data.icon');
});

it('génère un slug unique (suffixe -2, -3) puis le garde stable à la modification', function () {
    $this->actingAs(makeAdmin());
    $first = $this->postJson(REF.'post-categories', ['name' => 'Actualités'])->assertCreated()->json('data');
    $second = $this->postJson(REF.'post-categories', ['name' => 'ACTUALITES'])->assertUnprocessable()->json();
    expect($first['slug'])->toBe('actualites')->and($second['errors'])->toHaveKey('name');

    // Un nom différent produisant le même slug obtient un suffixe.
    $b = $this->postJson(REF.'post-categories', ['name' => 'Actualités !'])->assertCreated()->json('data');
    $c = $this->postJson(REF.'post-categories', ['name' => 'Actualités ?'])->assertCreated()->json('data');
    expect($b['slug'])->toBe('actualites-2')->and($c['slug'])->toBe('actualites-3');

    $this->patchJson(REF.'post-categories/'.$first['id'], ['name' => 'Tout autre nom'])
        ->assertOk()->assertJsonPath('data.slug', 'actualites')->assertJsonPath('data.name', 'Tout autre nom');
    $this->patchJson(REF.'post-categories/'.$first['id'], ['slug' => 'pirate'])->assertOk()->assertJsonPath('data.slug', 'actualites');
});

it('valide la création : nom obligatoire/trop long, ordre, visibilité, icône', function () {
    $this->actingAs(makeAdmin());
    $this->postJson(REF.'company-types', [])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson(REF.'company-types', ['name' => str_repeat('a', 151)])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson(REF.'company-types', ['name' => 'Valide', 'sort_order' => 32768])->assertUnprocessable()->assertJsonValidationErrors('sort_order');
    $this->postJson(REF.'company-types', ['name' => 'Valide', 'sort_order' => -1])->assertUnprocessable()->assertJsonValidationErrors('sort_order');
    $this->postJson(REF.'company-types', ['name' => 'Valide', 'is_visible' => 'oui'])->assertUnprocessable()->assertJsonValidationErrors('is_visible');
    $this->postJson(REF.'service-types', ['name' => 'Valide', 'icon' => '../../etc'])->assertUnprocessable()->assertJsonValidationErrors('icon');
    $this->postJson(REF.'company-types', ['name' => 'Valide', 'sort_order' => 32767])->assertCreated();
    expect(CompanyType::query()->count())->toBe(1);
});

it('modifie une valeur : champs autorisés seulement, audit des changements, aucun audit si rien ne change', function () {
    $admin = makeAdmin();
    $type = CompanyType::factory()->create(['name' => 'Ancien', 'sort_order' => 1, 'is_visible' => true]);
    Cache::put('reference-data:v1', ['stale' => true]);

    $this->actingAs($admin)->patchJson(REF.'company-types/'.$type->id, [
        'name' => 'Nouveau', 'is_visible' => false, 'sort_order' => 5, 'created_at' => '2000-01-01',
    ])->assertOk()->assertJsonPath('data.name', 'Nouveau')->assertJsonPath('data.is_visible', false);

    expect(Cache::has('reference-data:v1'))->toBeFalse();
    $log = AuditLog::where('event', 'reference_updated')->sole();
    expect($log->user_id)->toBe($admin->id)->and($log->old_values['name'])->toBe('Ancien')->and($log->new_values['name'])->toBe('Nouveau');

    $this->patchJson(REF.'company-types/'.$type->id, ['name' => 'Nouveau'])->assertOk();
    expect(AuditLog::where('event', 'reference_updated')->count())->toBe(1);
    $this->patchJson(REF.'company-types/999999', ['name' => 'Valide'])->assertNotFound();
});

it('refuse un nom déjà pris (422) mais autorise le même nom dans une autre ville', function () {
    $this->actingAs(makeAdmin());
    CompanyType::factory()->create(['name' => 'Association']);
    $this->postJson(REF.'company-types', ['name' => 'association'])->assertUnprocessable()->assertJsonValidationErrors('name');

    $abidjan = City::factory()->create();
    $bouake = City::factory()->create();
    $this->postJson(REF.'districts', ['name' => 'Centre', 'city_id' => $abidjan->id])->assertCreated();
    $this->postJson(REF.'districts', ['name' => 'Centre', 'city_id' => $abidjan->id])->assertUnprocessable();
    $this->postJson(REF.'districts', ['name' => 'Centre', 'city_id' => $bouake->id])->assertCreated()->assertJsonPath('data.slug', 'centre');
});

it('gère les villes : coordonnées en paire et slug stable', function () {
    $this->actingAs(makeAdmin());
    $city = $this->postJson(REF.'cities', ['name' => 'Yamoussoukro', 'lat' => 6.8276, 'lng' => -5.2893, 'sort_order' => 2])
        ->assertCreated()->assertJsonPath('data.lat', 6.8276)->assertJsonPath('data.lng', -5.2893)->json('data');

    $this->postJson(REF.'cities', ['name' => 'Sans longitude', 'lat' => 5.3])->assertUnprocessable()->assertJsonValidationErrors('lat');
    $this->postJson(REF.'cities', ['name' => 'Hors limites', 'lat' => 91, 'lng' => 0])->assertUnprocessable()->assertJsonValidationErrors('latitude');
    $this->patchJson(REF.'cities/'.$city['id'], ['lng' => 3.0])->assertUnprocessable()->assertJsonValidationErrors('lat');
    $this->patchJson(REF.'cities/'.$city['id'], ['lat' => null, 'lng' => null])->assertOk()->assertJsonPath('data.lat', null);
    expect(City::find($city['id'])->slug)->toBe('yamoussoukro');
});

it('gère les quartiers : ville et parent cohérents, sans cycle', function () {
    $this->actingAs(makeAdmin());
    $city = City::factory()->create();
    $other = City::factory()->create();
    $foreign = District::factory()->create(['city_id' => $other->id]);

    $this->postJson(REF.'districts', ['name' => 'Sans ville'])->assertUnprocessable()->assertJsonValidationErrors('city_id');
    $this->postJson(REF.'districts', ['name' => 'Q', 'city_id' => 999999])->assertUnprocessable()->assertJsonValidationErrors('city_id');
    $this->postJson(REF.'districts', ['name' => 'Autre', 'city_id' => $city->id, 'parent_id' => $foreign->id])
        ->assertUnprocessable()->assertJsonValidationErrors('parent_id');

    $parent = $this->postJson(REF.'districts', ['name' => 'Cocody', 'city_id' => $city->id])->assertCreated()->json('data');
    $child = $this->postJson(REF.'districts', ['name' => 'Riviera', 'city_id' => $city->id, 'parent_id' => $parent['id']])
        ->assertCreated()->assertJsonPath('data.parent_id', $parent['id'])->json('data');

    $this->patchJson(REF.'districts/'.$parent['id'], ['parent_id' => $parent['id']])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    $this->patchJson(REF.'districts/'.$parent['id'], ['parent_id' => $child['id']])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    $this->patchJson(REF.'districts/'.$child['id'], ['city_id' => $other->id])->assertUnprocessable()->assertJsonValidationErrors('city_id');
    $this->patchJson(REF.'districts/'.$child['id'], ['parent_id' => null, 'is_visible' => false])->assertOk()->assertJsonPath('data.parent_id', null);
    expect(District::find($child['id'])->is_visible)->toBeFalse();
});

it('supprime une valeur inutilisée (204) et refuse une valeur utilisée (409)', function () {
    $admin = makeAdmin();
    $city = City::factory()->create();
    $type = CompanyType::factory()->create();
    $provider = makeProvider([], $city);
    DB::table('provider_company_type')->insert(['provider_id' => $provider->id, 'company_type_id' => $type->id]);
    Cache::put('home:stats:v1', ['stale' => true]);

    $this->actingAs($admin)->deleteJson(REF.'company-types/'.$type->id)
        ->assertStatus(409)->assertJsonPath('message', 'Valeur utilisée, masquez-la plutôt.');
    $this->deleteJson(REF.'cities/'.$city->id)->assertStatus(409);
    expect(CompanyType::find($type->id))->not->toBeNull()->and(Cache::has('home:stats:v1'))->toBeTrue();

    DB::table('provider_company_type')->delete();
    $this->deleteJson(REF.'company-types/'.$type->id)->assertNoContent();
    expect(CompanyType::find($type->id))->toBeNull()->and(Cache::has('home:stats:v1'))->toBeFalse();

    $log = AuditLog::where('event', 'reference_deleted')->sole();
    expect($log->user_id)->toBe($admin->id)->and($log->context)->toMatchArray(['resource' => 'company-types', 'id' => $type->id]);

    $unused = PostCategory::factory()->create();
    $this->deleteJson(REF.'post-categories/'.$unused->id)->assertNoContent();
    $this->deleteJson(REF.'post-categories/'.$unused->id)->assertNotFound();
});

it('refuse de supprimer un quartier qui a des enfants ou une ville qui a des quartiers', function () {
    $this->actingAs(makeAdmin());
    $city = City::factory()->create();
    $parent = District::factory()->create(['city_id' => $city->id]);
    $child = District::factory()->create(['city_id' => $city->id, 'parent_id' => $parent->id]);

    $this->deleteJson(REF.'districts/'.$parent->id)->assertStatus(409);
    $this->deleteJson(REF.'cities/'.$city->id)->assertStatus(409);
    $this->deleteJson(REF.'districts/'.$child->id)->assertNoContent();
    $this->deleteJson(REF.'districts/'.$parent->id)->assertNoContent();
    $this->deleteJson(REF.'cities/'.$city->id)->assertNoContent();
});
