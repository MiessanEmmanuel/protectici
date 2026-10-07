<?php

use App\Models\CompanyType;
use App\Models\ProviderExecutive;
use App\Models\Review;
use App\Models\User;

it('renvoie la fiche détaillée au format du contrat', function () {
    $p = makeProvider([
        'rccm' => 'CI-ABJ-DEMO-0001', 'approval_number' => 'AGR-DEMO-0001', 'legal_form' => 'sarl', 'share_capital' => 1000000,
        'corporate_purpose' => 'Sécurité', 'facebook_url' => 'https://facebook.com/x', 'whatsapp_number' => '+2250700000000',
    ]);
    $p->companyTypes()->attach(CompanyType::factory()->create());
    ProviderExecutive::factory()->create(['provider_id' => $p->id, 'full_name' => 'Visible Dirigeant', 'is_visible' => true]);
    ProviderExecutive::factory()->hiddenFromPublic()->create(['provider_id' => $p->id, 'full_name' => 'Caché Dirigeant']);

    $r = $this->getJson('/api/v1/providers/'.$p->slug)->assertOk();
    $d = $r->json('data');

    expect(array_keys($d))->toEqualCanonicalizing([...SUMMARY_KEYS, 'description', 'address', 'geo_description', 'plus_code', 'email', 'website_url', 'emergency_phone', 'socials', 'company_types', 'legal', 'executives', 'gallery', 'views_count', 'is_favorite']);
    expect(array_keys($d['socials']))->toBe(['facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp']);
    expect($d['legal'])->toBe(['legal_form' => 'sarl', 'share_capital' => 1000000, 'rccm' => 'CI-ABJ-DEMO-0001', 'approval_number' => 'AGR-DEMO-0001', 'corporate_purpose' => 'Sécurité']);
    expect($d['executives'])->toHaveCount(1)->and($d['executives'][0]['full_name'])->toBe('Visible Dirigeant');
    expect(array_keys($d['executives'][0]))->toBe(['full_name', 'position', 'position_label']);
    expect($d['company_types'][0])->toHaveKeys(['id', 'slug', 'name']);
    expect($d['is_favorite'])->toBeNull();
    expect(json_encode($d))->not->toContain('Caché Dirigeant');
});

it('indique is_favorite pour un utilisateur connecté', function () {
    $p = makeProvider();
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/api/v1/providers/'.$p->slug)->assertOk()->assertJsonPath('data.is_favorite', false);
    $user->favoriteProviders()->attach($p->id);
    $this->actingAs($user)->getJson('/api/v1/providers/'.$p->slug)->assertJsonPath('data.is_favorite', true);
});

it('renvoie 404 JSON pour un slug inconnu', function () {
    $this->getJson('/api/v1/providers/inconnu')->assertNotFound()->assertExactJson(['message' => 'Ressource introuvable.']);
});

it('liste les avis publiés avec auteur « Prénom N. »', function () {
    $p = makeProvider();
    $author = User::factory()->create(['first_name' => 'Aminata', 'last_name' => 'Koné', 'email' => 'secret@example.test']);
    Review::factory()->replied('Merci !')->create(['provider_id' => $p->id, 'user_id' => $author->id, 'rating' => 5, 'title' => 'Top']);
    Review::factory()->pending()->create(['provider_id' => $p->id]);
    Review::factory()->rejected()->create(['provider_id' => $p->id]);
    $anon = Review::factory()->create(['provider_id' => $p->id, 'user_id' => null]);
    $other = Review::factory()->create(['provider_id' => makeProvider()->id]);

    $r = $this->getJson('/api/v1/providers/'.$p->slug.'/reviews?per_page=5')->assertOk();

    expect($r->json('data'))->toHaveCount(2);
    $first = collect($r->json('data'))->firstWhere('title', 'Top');
    expect(array_keys($first))->toBe(['id', 'rating', 'title', 'body', 'author', 'created_at', 'provider_reply', 'provider_replied_at']);
    expect($first['author'])->toBe('Aminata K.')->and($first['provider_reply'])->toBe('Merci !');
    expect($first['created_at'])->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/');
    expect(collect($r->json('data'))->pluck('author')->all())->toContain('Anonyme');
    expect(json_encode($r->json()))->not->toContain('secret@example.test')->not->toContain('"email"');
    expect($r->json('meta.per_page'))->toBe(5)->and($r->json('meta.total'))->toBe(2);
    expect(collect($r->json('data'))->pluck('id')->all())->not->toContain($other->id);
});

it('valide la pagination des avis', function () {
    $p = makeProvider();
    $this->getJson('/api/v1/providers/'.$p->slug.'/reviews?page=0')->assertUnprocessable();
    expect($this->getJson('/api/v1/providers/'.$p->slug.'/reviews?per_page=999')->json('meta.per_page'))->toBe(50);
});

it('compte les vues une fois par IP et par fiche', function () {
    $p = makeProvider();

    $this->postJson('/api/v1/providers/'.$p->slug.'/view')->assertNoContent();
    $this->postJson('/api/v1/providers/'.$p->slug.'/view')->assertNoContent();
    expect($p->fresh()->views_count)->toBe(1);

    $this->withServerVariables(['REMOTE_ADDR' => '10.9.9.9'])->postJson('/api/v1/providers/'.$p->slug.'/view')->assertNoContent();
    expect($p->fresh()->views_count)->toBe(2);
});

it('limite le débit du compteur de vues', function () {
    $p = makeProvider();
    foreach (range(1, 30) as $i) {
        $this->postJson('/api/v1/providers/'.$p->slug.'/view')->assertNoContent();
    }
    $this->postJson('/api/v1/providers/'.$p->slug.'/view')->assertTooManyRequests()->assertHeader('Retry-After');
});
