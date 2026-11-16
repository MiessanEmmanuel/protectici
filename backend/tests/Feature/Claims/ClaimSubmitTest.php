<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\ConsentLog;
use App\Models\EstablishmentClaim;
use App\Models\Provider;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Claims\ClaimMail;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Storage::fake('private');
    config(['establishments.documents_disk' => 'private']);
    Notification::fake();
});

it('enregistre une revendication : justificatif renommé sur disque privé, consentement, audit sans téléphone, e-mails', function () {
    $admin = makeAdmin();
    $user = User::factory()->create();
    $provider = makeProvider();

    $res = $this->actingAs($user)->post(claimUrl($provider), claimPayload(['document' => claimPdf('../../Mon RCCM.php.pdf')]), ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.establishment', ['type' => 'provider', 'slug' => $provider->slug, 'name' => $provider->name])
        ->assertJsonPath('data.rejection_reason', null)
        ->assertJsonPath('data.reviewed_at', null);
    expect(array_keys($res->json('data')))->toEqualCanonicalizing(['id', 'status', 'establishment', 'rejection_reason', 'created_at', 'reviewed_at']);

    $claim = EstablishmentClaim::firstOrFail();
    expect($claim->provider_id)->toBe($provider->id)
        ->and($claim->user_id)->toBe($user->id)
        ->and($claim->phone)->toBe('+2250709445111')
        ->and($claim->document_mime_type)->toBe('application/pdf')
        ->and($claim->document_path)->toStartWith('claims/provider/'.$provider->id.'/')->toEndWith('.pdf')->not->toContain('RCCM')
        ->and($claim->document_original_name)->not->toContain('/');
    Storage::disk('private')->assertExists($claim->document_path);

    expect(ConsentLog::where('purpose', 'claim')->where('user_id', $user->id)->count())->toBe(1);

    $audit = AuditLog::where('event', 'claim_submitted')->firstOrFail();
    expect($audit->auditable_id)->toBe($provider->id)
        ->and(json_encode([$audit->old_values, $audit->new_values, $audit->context]))->not->toContain('0709445111')->not->toContain('claims/');

    Notification::assertSentTo($user, ClaimMail::class, fn (ClaimMail $m) => $m->event === ClaimMail::RECEIVED);
    Notification::assertSentTo($admin, AdminAlert::class, fn (AdminAlert $a) => $a->kind === AdminAlert::KIND_CLAIM_RECEIVED
        && ! str_contains(json_encode($a->toArray($admin)), '0709445111'));
    expect($provider->fresh()->user_id)->toBeNull();
});

it('accepte une revendication de force étatique avec une image (réencodée)', function () {
    $user = User::factory()->create();
    $force = makeStateForce();

    $this->actingAs($user)->post(claimUrl($force), claimPayload([
        'submitter_role' => 'employee',
        'document' => UploadedFile::fake()->createWithContent('carte.png', pngBytes()),
    ]), ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.establishment.type', 'state_force');

    $claim = EstablishmentClaim::firstOrFail();
    expect($claim->state_force_id)->toBe($force->id)->and($claim->document_mime_type)->toBe('image/png');
});

it('refuse un anonyme (401) et un compte non vérifié (403)', function () {
    $provider = makeProvider();
    $this->post(claimUrl($provider), claimPayload(), ['Accept' => 'application/json'])->assertUnauthorized();

    $this->actingAs(User::factory()->unverified()->create())
        ->post(claimUrl($provider), claimPayload(), ['Accept' => 'application/json'])->assertForbidden();
    expect(EstablishmentClaim::count())->toBe(0);
});

it('renvoie 404 pour une fiche non publiée, supprimée ou inconnue', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $pending = pendingProviderOf($other);
    $hidden = Provider::factory()->hidden()->create(['city_id' => City::factory()->create()->id]);
    $deleted = makeProvider();
    $deleted->delete();

    foreach ([$pending, $hidden, $deleted] as $p) {
        $this->actingAs($user)->post(claimUrl($p), claimPayload(), ['Accept' => 'application/json'])->assertNotFound();
    }
    $this->actingAs($user)->post('/api/v1/establishments/provider/inconnue/claims', claimPayload(), ['Accept' => 'application/json'])->assertNotFound();
    $this->actingAs($user)->post('/api/v1/establishments/autre/x/claims', claimPayload(), ['Accept' => 'application/json'])->assertNotFound();
    expect(EstablishmentClaim::count())->toBe(0);
});

it('renvoie 409 si la fiche a déjà un propriétaire (y compris soi-même) ou si une demande est en cours', function () {
    $owner = User::factory()->provider()->create();
    $user = User::factory()->create();
    $owned = makeProvider(['user_id' => $owner->id]);

    foreach ([$owner, $user] as $who) {
        $this->actingAs($who)->post(claimUrl($owned), claimPayload(), ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('message', 'Cette fiche est déjà gérée par un compte.');
    }

    $free = makeProvider();
    $this->actingAs($user)->post(claimUrl($free), claimPayload(), ['Accept' => 'application/json'])->assertCreated();
    $this->actingAs($user)->post(claimUrl($free), claimPayload(), ['Accept' => 'application/json'])
        ->assertStatus(409)->assertJsonPath('message', 'Vous avez déjà une demande en cours pour cette fiche.');

    expect(EstablishmentClaim::count())->toBe(1)->and(Storage::disk('private')->allFiles())->toHaveCount(1);
});

it('garantit en base une seule demande en attente par fiche et par compte (course)', function () {
    $user = User::factory()->create();
    $provider = makeProvider();
    $insert = fn () => (new EstablishmentClaim)->forceFill([
        'provider_id' => $provider->id, 'user_id' => $user->id, 'submitter_role' => 'manager', 'phone' => '+2250700000000', 'status' => 'pending',
    ])->save();

    $insert();
    expect($insert)->toThrow(UniqueConstraintViolationException::class);
});

it('valide les champs et le type réel du justificatif', function () {
    $user = User::factory()->create();
    $provider = makeProvider();
    $send = fn (array $o) => $this->actingAs($user)->post(claimUrl($provider), claimPayload($o), ['Accept' => 'application/json']);

    $this->actingAs($user)->post(claimUrl($provider), [], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonValidationErrors(['submitter_role', 'phone', 'document', 'consent']);
    $send(['submitter_role' => 'owner'])->assertUnprocessable()->assertJsonValidationErrors('submitter_role');
    $send(['phone' => '12'])->assertUnprocessable()->assertJsonValidationErrors('phone');
    $send(['message' => str_repeat('a', 1001)])->assertUnprocessable()->assertJsonValidationErrors('message');
    $send(['consent' => '0'])->assertUnprocessable()->assertJsonValidationErrors('consent');
    $send(['document' => UploadedFile::fake()->create('gros.pdf', 6000, 'application/pdf')])->assertUnprocessable()->assertJsonValidationErrors('document');
    // Faux PDF (texte renommé) et PDF à contenu actif : refusés par le contrôle du contenu.
    $send(['document' => UploadedFile::fake()->createWithContent('faux.pdf', '<?php echo 1;')])->assertUnprocessable()->assertJsonValidationErrors('document');
    $send(['document' => UploadedFile::fake()->createWithContent('actif.pdf', "%PDF-1.4\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF")])
        ->assertUnprocessable()->assertJsonValidationErrors('document');

    expect(EstablishmentClaim::count())->toBe(0)->and(Storage::disk('private')->allFiles())->toBe([]);
});

it('limite à 5 demandes enregistrées par jour et par compte (429), les tentatives invalides ne comptent pas', function () {
    $user = User::factory()->create();
    $city = City::factory()->create();

    foreach (range(1, 6) as $i) {
        $this->actingAs($user)->post(claimUrl(makeProvider([], $city)), claimPayload(['phone' => '12']), ['Accept' => 'application/json'])->assertUnprocessable();
    }

    foreach (range(1, 5) as $i) {
        $this->actingAs($user)->post(claimUrl(makeProvider([], $city)), claimPayload(), ['Accept' => 'application/json'])->assertCreated();
    }
    $this->actingAs($user)->post(claimUrl(makeProvider([], $city)), claimPayload(), ['Accept' => 'application/json'])
        ->assertStatus(429)->assertHeader('Retry-After');
    expect(EstablishmentClaim::count())->toBe(5);
});

it('liste uniquement ses propres demandes (GET /me/claims)', function () {
    $this->getJson('/api/v1/me/claims')->assertUnauthorized();

    $me = User::factory()->create();
    $other = User::factory()->create();
    $p1 = makeProvider();
    $p2 = makeProvider();
    $this->actingAs($me)->post(claimUrl($p1), claimPayload(), ['Accept' => 'application/json'])->assertCreated();
    $this->actingAs($other)->post(claimUrl($p2), claimPayload(), ['Accept' => 'application/json'])->assertCreated();

    $res = $this->actingAs($me)->getJson('/api/v1/me/claims')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.establishment.slug', $p1->slug);
    expect(json_encode($res->json()))->not->toContain('0709445111')->not->toContain('document');
});

it('expose is_claimable sur les fiches publiques de détail', function () {
    $free = makeProvider();
    $owned = makeProvider(['user_id' => User::factory()->provider()->create()->id]);
    $force = makeStateForce();

    $this->getJson('/api/v1/providers/'.$free->slug)->assertOk()->assertJsonPath('data.is_claimable', true);
    $this->getJson('/api/v1/providers/'.$owned->slug)->assertOk()->assertJsonPath('data.is_claimable', false);
    $this->getJson('/api/v1/state-forces/'.$force->slug)->assertOk()->assertJsonPath('data.is_claimable', true);
});
