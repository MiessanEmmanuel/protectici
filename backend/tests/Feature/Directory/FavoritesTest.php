<?php

use App\Models\City;
use App\Models\Provider;
use App\Models\User;

it('exige une authentification pour les favoris', function () {
    $p = makeProvider();

    $this->getJson('/api/v1/me/favorites')->assertUnauthorized();
    $this->putJson('/api/v1/providers/'.$p->slug.'/favorite')->assertUnauthorized();
    $this->deleteJson('/api/v1/providers/'.$p->slug.'/favorite')->assertUnauthorized();
});

it('refuse les favoris sans e-mail vérifié avec un message français', function () {
    $p = makeProvider();
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->putJson('/api/v1/providers/'.$p->slug.'/favorite')
        ->assertForbidden()
        ->assertJson(['message' => 'Veuillez vérifier votre adresse e-mail pour ajouter des favoris.']);
    expect($user->favoriteProviders()->count())->toBe(0);
});

it('ajoute un favori de façon idempotente puis le retire', function () {
    $p = makeProvider();
    $user = User::factory()->create();

    $this->actingAs($user)->putJson('/api/v1/providers/'.$p->slug.'/favorite')->assertNoContent();
    $this->actingAs($user)->putJson('/api/v1/providers/'.$p->slug.'/favorite')->assertNoContent();
    expect($user->favoriteProviders()->count())->toBe(1);

    $this->actingAs($user)->deleteJson('/api/v1/providers/'.$p->slug.'/favorite')->assertNoContent();
    $this->actingAs($user)->deleteJson('/api/v1/providers/'.$p->slug.'/favorite')->assertNoContent();
    expect($user->favoriteProviders()->count())->toBe(0);
});

it('refuse de mettre en favori une fiche non publiée', function () {
    $p = Provider::factory()->pending()->create(['city_id' => City::factory()->create()->id]);

    $this->actingAs(User::factory()->create())->putJson('/api/v1/providers/'.$p->slug.'/favorite')->assertNotFound();
});

it('liste ses propres favoris publiés, paginés', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $city = City::factory()->create();
    $a = makeProvider([], $city);
    $b = makeProvider([], $city);
    $hidden = makeProvider([], $city);
    $user->favoriteProviders()->attach([$a->id, $b->id, $hidden->id]);
    $other->favoriteProviders()->attach($b->id);
    $hidden->forceFill(['is_visible' => false])->save();

    $r = $this->actingAs($user)->getJson('/api/v1/me/favorites?per_page=1')->assertOk();

    expect($r->json('meta.total'))->toBe(2)->and($r->json('data'))->toHaveCount(1);
    expect(array_keys($r->json('data.0')))->toEqualCanonicalizing(SUMMARY_KEYS);
    expect(collect($this->actingAs($user)->getJson('/api/v1/me/favorites')->json('data'))->pluck('slug')->all())->not->toContain($hidden->slug);
});
