<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\District;
use App\Models\Provider;
use App\Models\ProviderBranch;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
});

function branchPayload(City $city, array $overrides = []): array
{
    return array_merge(['label' => 'Agence de Cocody', 'city_id' => $city->id], $overrides);
}

it('enregistre les agences à l\'inscription, texte nettoyé et téléphone normalisé', function () {
    $user = User::factory()->create();
    $city = City::factory()->create(['is_visible' => true]);
    $district = District::factory()->create(['city_id' => $city->id, 'is_visible' => true]);

    $res = $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['branches' => [
        branchPayload($city, [
            'label' => "  Agence\tde Cocody ", 'district_id' => $district->id, 'address' => "Rue fictive\x07 12",
            'phone' => '07 09 44 51 12', 'lat' => 5.35, 'lng' => -4.01,
        ]),
        branchPayload($city, ['label' => 'Agence de Yopougon']),
    ]]))->assertCreated();

    expect($res->json('data.branches'))->toHaveCount(2);
    expect(array_keys($res->json('data.branches.0')))->toBe(['id', 'label', 'city_id', 'district_id', 'address', 'geo_description', 'phone', 'lat', 'lng']);

    $p = Provider::query()->where('slug', $res->json('data.slug'))->firstOrFail();
    $first = $p->branches()->first();
    expect($first->label)->toBe('Agence de Cocody')
        ->and($first->address)->toBe('Rue fictive 12')
        ->and($first->phone)->toBe('+2250709445112')
        ->and($first->sort_order)->toBe(0)
        ->and((float) $first->latitude)->toBe(5.35);
});

it('rejette le HTML dans les agences (422)', function () {
    $city = City::factory()->create(['is_visible' => true]);

    $this->actingAs(User::factory()->create())->postJson('/api/v1/establishments', providerPayload(['branches' => [
        branchPayload($city, ['label' => '<b>Agence</b> de Cocody']),
    ]]))->assertUnprocessable()->assertJsonValidationErrors(['branches.0.label']);
});

it('accepte une inscription sans agence', function () {
    $this->actingAs(User::factory()->create())->postJson('/api/v1/establishments', providerPayload())
        ->assertCreated()->assertJsonPath('data.branches', []);
});

it('valide les agences', function (array $branch, string $errorKey) {
    $city = City::factory()->create(['is_visible' => true]);

    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/establishments', providerPayload(['branches' => [branchPayload($city, $branch)]]))
        ->assertUnprocessable()->assertJsonValidationErrors($errorKey);
})->with([
    'nom absent' => [['label' => ''], 'branches.0.label'],
    'nom trop long' => [['label' => str_repeat('a', 151)], 'branches.0.label'],
    'ville inconnue' => [['city_id' => 999999], 'branches.0.city_id'],
    'téléphone invalide' => [['phone' => 'abc'], 'branches.0.phone'],
    'latitude hors limites' => [['lat' => 91, 'lng' => 0], 'branches.0.lat'],
    'latitude sans longitude' => [['lat' => 5.3], 'branches.0.lng'],
    'longitude sans latitude' => [['lng' => -4.0], 'branches.0.lat'],
]);

it('limite le nombre d\'agences à 20', function () {
    $city = City::factory()->create(['is_visible' => true]);
    $branches = array_fill(0, 21, branchPayload($city));

    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/establishments', providerPayload(['branches' => $branches]))
        ->assertUnprocessable()->assertJsonValidationErrors('branches');
});

it('refuse un quartier d\'une autre ville et n\'enregistre rien', function () {
    $user = User::factory()->create();
    $city = City::factory()->create(['is_visible' => true]);
    $other = District::factory()->create(['city_id' => City::factory()->create()->id, 'is_visible' => true]);

    $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['branches' => [
        branchPayload($city, ['id' => 1]),
        branchPayload($city, ['district_id' => $other->id]),
    ]]))->assertUnprocessable()->assertJsonValidationErrors('branches.1.district_id');

    expect(Provider::query()->where('user_id', $user->id)->exists())->toBeFalse()
        ->and(ProviderBranch::query()->count())->toBe(0);
});

it('laisse le propriétaire remplacer ses agences en conservant celles qui ont un id', function () {
    $owner = User::factory()->create();
    $city = City::factory()->create(['is_visible' => true]);
    $p = makeProvider(['user_id' => $owner->id], $city);
    $kept = ProviderBranch::factory()->create(['provider_id' => $p->id, 'city_id' => $city->id, 'label' => 'Ancien nom']);
    $removed = ProviderBranch::factory()->create(['provider_id' => $p->id, 'city_id' => $city->id]);

    $res = $this->actingAs($owner)->patchJson("/api/v1/me/establishments/provider/{$p->slug}", ['branches' => [
        branchPayload($city, ['label' => 'Nouvelle agence']),
        branchPayload($city, ['id' => $kept->id, 'label' => 'Nouveau nom']),
    ]])->assertOk();

    expect($res->json('data.branches.0.label'))->toBe('Nouvelle agence')
        ->and($res->json('data.branches.1.id'))->toBe($kept->id)
        ->and($res->json('data.branches.1.label'))->toBe('Nouveau nom');
    expect(ProviderBranch::query()->find($removed->id))->toBeNull();
    expect(AuditLog::where('event', 'establishment_updated')->latest('id')->first()->context['fields'] ?? [])->toContain('branches');
});

it('ne touche pas aux agences si le champ est absent et les supprime avec une liste vide', function () {
    $owner = User::factory()->create();
    $city = City::factory()->create(['is_visible' => true]);
    $p = makeProvider(['user_id' => $owner->id], $city);
    ProviderBranch::factory()->create(['provider_id' => $p->id, 'city_id' => $city->id]);

    $this->actingAs($owner)->patchJson("/api/v1/me/establishments/provider/{$p->slug}", ['description' => 'Autre'])->assertOk();
    expect($p->branches()->count())->toBe(1);

    $this->actingAs($owner)->patchJson("/api/v1/me/establishments/provider/{$p->slug}", ['branches' => []])->assertOk();
    expect($p->branches()->count())->toBe(0);
});

it('ne permet pas de reprendre l\'agence d\'une autre fiche par son id', function () {
    $owner = User::factory()->create();
    $city = City::factory()->create(['is_visible' => true]);
    $mine = makeProvider(['user_id' => $owner->id], $city);
    $foreign = ProviderBranch::factory()->create(['provider_id' => makeProvider([], $city)->id, 'city_id' => $city->id, 'label' => 'Agence d\'autrui']);

    $this->actingAs($owner)->patchJson("/api/v1/me/establishments/provider/{$mine->slug}", ['branches' => [
        branchPayload($city, ['id' => $foreign->id, 'label' => 'Détournée']),
    ]])->assertOk();

    expect($foreign->fresh()->label)->toBe('Agence d\'autrui')
        ->and($foreign->fresh()->provider_id)->not->toBe($mine->id)
        ->and($mine->branches()->first()->label)->toBe('Détournée');
});

it('répond 404 si un autre utilisateur modifie les agences', function () {
    $city = City::factory()->create(['is_visible' => true]);
    $p = makeProvider(['user_id' => User::factory()->create()->id], $city);

    $this->actingAs(User::factory()->create())
        ->patchJson("/api/v1/me/establishments/provider/{$p->slug}", ['branches' => [branchPayload($city)]])
        ->assertNotFound();
    expect($p->branches()->count())->toBe(0);
});

it('laisse l\'administrateur modifier les agences', function () {
    $city = City::factory()->create(['is_visible' => true]);
    $p = makeProvider([], $city);

    $this->actingAs(makeAdmin())->patchJson("/api/v1/admin/establishments/provider/{$p->id}", ['branches' => [branchPayload($city)]])
        ->assertOk()->assertJsonPath('data.branches.0.label', 'Agence de Cocody');
});

it('renvoie une liste vide pour une force étatique et ignore les agences envoyées', function () {
    $res = $this->actingAs(User::factory()->create())->postJson('/api/v1/establishments', stateForcePayload([
        'branches' => [['label' => 'Agence', 'city_id' => City::factory()->create()->id]],
    ]))->assertCreated();

    expect($res->json('data.branches'))->toBe([])->and(ProviderBranch::query()->count())->toBe(0);
});
