<?php

use App\Models\City;
use App\Models\Provider;
use App\Models\User;

const SIMILAR_URL = '/api/v1/establishments/similar';

it('exige une session et un e-mail vérifié', function () {
    $this->getJson(SIMILAR_URL.'?type=provider&name=Sentinelle')->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->getJson(SIMILAR_URL.'?type=provider&name=Sentinelle')->assertForbidden();
});

it('valide les paramètres', function () {
    $this->actingAs(User::factory()->create())->getJson(SIMILAR_URL.'?type=autre&name=ab')
        ->assertUnprocessable()->assertJsonValidationErrors(['type', 'name']);
});

it('trouve les fiches publiées au nom approchant (accents, casse) dans la ville, ou au même téléphone', function () {
    $user = User::factory()->create();
    $abidjan = City::factory()->create();
    $bouake = City::factory()->create();

    $match = makeProvider(['name' => 'Sécurité Sentinelle Plateau'], $abidjan);
    makeProvider(['name' => 'Securite Sentinelle Plateau'], $bouake); // autre ville
    Provider::factory()->pending()->create(['name' => 'Sécurité Sentinelle Plateau', 'city_id' => $abidjan->id]); // non publiée
    $byPhone = makeProvider(['name' => 'Tout autre nom', 'phone' => '+2250102030405'], $bouake);

    $res = $this->actingAs($user)->getJson(SIMILAR_URL.'?'.http_build_query([
        'type' => 'provider', 'name' => 'securite sentinelle plateau', 'city_id' => $abidjan->id, 'phone' => '01 02 03 04 05',
    ]))->assertOk();

    $slugs = collect($res->json('data'))->pluck('slug')->all();
    expect($slugs)->toEqualCanonicalizing([$match->slug, $byPhone->slug]);
    expect(array_keys($res->json('data.0')))->toEqualCanonicalizing(['type', 'slug', 'name', 'city', 'is_claimable']);
    expect(json_encode($res->json()))->not->toContain('+2250102030405');
});

it('renvoie au plus 5 fiches et indique is_claimable', function () {
    $user = User::factory()->create();
    $city = City::factory()->create();
    foreach (range(1, 7) as $i) {
        makeProvider(['name' => 'Gardiennage Horizon '.$i], $city);
    }
    makeStateForce(['name' => 'Commissariat Horizon']);

    $res = $this->actingAs($user)->getJson(SIMILAR_URL.'?type=provider&name=Gardiennage+Horizon')->assertOk()->assertJsonCount(5, 'data');
    expect(collect($res->json('data'))->pluck('type')->unique()->all())->toBe(['provider'])
        ->and($res->json('data.0.is_claimable'))->toBeTrue();
});
