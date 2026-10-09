<?php

use App\Models\AuditLog;
use App\Models\ConsentLog;
use App\Models\District;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Establishment\EstablishmentMail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    Notification::fake();
    RateLimiter::clear('x');
});

it('exige une session et un e-mail vérifié', function () {
    $this->postJson('/api/v1/establishments', providerPayload())->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())
        ->postJson('/api/v1/establishments', providerPayload())->assertForbidden()->assertJson(['code' => 'email_unverified']);
});

it('crée un prestataire pending invisible rattaché au demandeur, avec consentement, audit et notifications', function () {
    $user = User::factory()->create();
    $admin = makeAdmin();

    $res = $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['status' => 'approved', 'is_visible' => true, 'user_id' => 999, 'is_verified' => true]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.is_visible', false)
        ->assertJsonPath('data.type', 'provider')
        ->assertJsonPath('data.phone', '+2250709445111');

    $p = Provider::query()->where('slug', $res->json('data.slug'))->firstOrFail();
    expect($p->user_id)->toBe($user->id)
        ->and($p->is_visible)->toBeFalse()->and($p->is_verified)->toBeFalse()
        ->and($p->description)->toBe('Société de gardiennage fictive.');
    expect(ConsentLog::where('user_id', $user->id)->where('purpose', 'establishment')->count())->toBe(1);
    expect(AuditLog::where('event', 'establishment_created')->count())->toBe(1);
    Notification::assertSentTo($user, EstablishmentMail::class, fn ($n) => $n->event === 'received');
    Notification::assertSentTo($admin, AdminAlert::class);
});

it('crée une force étatique pending', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/establishments', stateForcePayload(['opening_hours' => ['mon' => [['08:00', '17:00']]], 'is_open_24h' => false]))
        ->assertCreated()->assertJsonPath('data.type', 'state_force')->assertJsonPath('data.status', 'pending');
    expect(StateForce::count())->toBe(1);
});

it('valide la charge utile', function (array $override) {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/establishments', providerPayload($override))->assertUnprocessable();
})->with([
    'sans consentement' => [['consent' => false]],
    'type inconnu' => [['type' => 'autre']],
    'sans nom' => [['name' => '']],
    'téléphone invalide' => [['phone' => 'abc']],
    'site javascript' => [['website_url' => 'javascript:alert(1)']],
    'sans type d\'entreprise' => [['company_type_ids' => []]],
    'rôle invalide' => [['submitter_role' => 'boss']],
    'lat sans lng' => [['lat' => 5.3]],
    'ville inexistante' => [['city_id' => 999999]],
]);

it('rejoue une requête avec la même Idempotency-Key sans doublon ni second e-mail', function () {
    $user = User::factory()->create();
    $payload = providerPayload();
    $h = ['Idempotency-Key' => 'a1b2c3d4-e5f6-4789-aaaa-bbbbbbbbbbbb'];

    $a = $this->actingAs($user)->postJson('/api/v1/establishments', $payload, $h)->assertCreated();
    $b = $this->actingAs($user)->postJson('/api/v1/establishments', $payload, $h)->assertCreated();

    expect($b->json('data.slug'))->toBe($a->json('data.slug'));
    expect(Provider::count())->toBe(1);
    Notification::assertSentToTimes($user, EstablishmentMail::class, 1);

    // même clé, charge différente => 422
    $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => 'Autre nom']), $h)->assertUnprocessable();
    // clé mal formée
    $this->actingAs($user)->postJson('/api/v1/establishments', $payload, ['Idempotency-Key' => 'x'])->assertUnprocessable();
});

it('limite à 3 inscriptions par jour et par IP, sans compter les rejeux', function () {
    $user = User::factory()->create();
    foreach (range(1, 3) as $i) {
        $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => "Société $i"]), ['Idempotency-Key' => "cle-numero-$i"])->assertCreated();
    }
    $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(), ['Idempotency-Key' => 'cle-numero-1'])->assertUnprocessable(); // rejet de charge, pas 429
    $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => 'Quatrième']))->assertStatus(429)->assertHeader('Retry-After');
});

it('limite à 5 par jour et par utilisateur', function () {
    config(['establishments.submissions_per_ip_per_day' => 100]);
    $user = User::factory()->create();
    foreach (range(1, 5) as $i) {
        $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => "Société $i"]))->assertCreated();
    }
    $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => 'Sixième']))->assertStatus(429);
});

it('génère des slugs uniques', function () {
    config(['establishments.submissions_per_ip_per_day' => 100]);
    $user = User::factory()->create();
    $a = $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => 'Même Nom']))->json('data.slug');
    $b = $this->actingAs($user)->postJson('/api/v1/establishments', providerPayload(['name' => 'Même Nom']))->json('data.slug');
    expect($a)->not->toBe($b);
});

it('refuse un quartier qui n\'appartient pas à la ville', function () {
    $district = District::factory()->create(['is_visible' => true]);
    $payload = providerPayload(['district_id' => $district->id]);
    $this->actingAs(User::factory()->create())->postJson('/api/v1/establishments', $payload)->assertUnprocessable()->assertJsonValidationErrors('district_id');
});
