<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\StateForce;
use App\Models\StateForceType;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use Illuminate\Support\Facades\Notification;

beforeEach(fn () => Notification::fake());

it('exige une authentification sur tout l\'espace prestataire', function () {
    $this->getJson('/api/v1/me/establishments')->assertUnauthorized();
    $this->getJson('/api/v1/me/establishments/provider/x')->assertUnauthorized();
    $this->patchJson('/api/v1/me/establishments/provider/x', [])->assertUnauthorized();
});

it('liste uniquement mes établissements (providers et forces) avec statut et demandes en attente', function () {
    $me = User::factory()->create();
    $other = User::factory()->create();
    $mine = pendingProviderOf($me);
    pendingProviderOf($other);
    StateForce::factory()->create(['user_id' => $me->id, 'city_id' => City::factory()->create()->id]);

    $res = $this->actingAs($me)->getJson('/api/v1/me/establishments')->assertOk();

    expect($res->json('meta.total'))->toBe(2)
        ->and(collect($res->json('data'))->pluck('type')->sort()->values()->all())->toBe(['provider', 'state_force'])
        ->and($res->json('data.0'))->toHaveKeys(['type', 'slug', 'name', 'status', 'rejection_reason', 'is_visible', 'is_verified', 'submitted_at', 'reviewed_at', 'pending_change_requests']);
    expect(collect($res->json('data'))->pluck('slug'))->toContain($mine->slug);
});

it('renvoie 404 pour l\'établissement d\'autrui sur toutes les routes (IDOR)', function () {
    $me = User::factory()->create();
    $victim = pendingProviderOf(User::factory()->create());
    $base = '/api/v1/me/establishments/provider/'.$victim->slug;

    $this->actingAs($me)->getJson($base)->assertNotFound();
    $this->actingAs($me)->patchJson($base, ['description' => 'pirate'])->assertNotFound();
    $this->actingAs($me)->postJson($base.'/resubmit')->assertNotFound();
    $this->actingAs($me)->postJson($base.'/change-requests', ['changes' => ['name' => 'Pirate SARL']])->assertNotFound();
    $this->actingAs($me)->postJson($base.'/media', [])->assertNotFound();
    $this->actingAs($me)->postJson($base.'/documents', [])->assertNotFound();
    $this->actingAs($me)->deleteJson($base.'/media/1')->assertNotFound();
    $this->actingAs($me)->deleteJson($base.'/documents/1')->assertNotFound();
    $this->actingAs($me)->deleteJson($base.'/change-requests/1')->assertNotFound();
    expect($victim->fresh()->description)->not->toBe('pirate');
});

it('affiche le détail complet du propriétaire sans URL de justificatif', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me, ['rccm' => 'CI-ABJ-DEMO-1']);

    $this->actingAs($me)->getJson('/api/v1/me/establishments/provider/'.$p->slug)->assertOk()
        ->assertJsonPath('data.rccm', 'CI-ABJ-DEMO-1')
        ->assertJsonStructure(['data' => ['company_type_ids', 'service_type_ids', 'executives', 'media', 'documents', 'change_requests', 'city_id', 'lat', 'lng']]);
});

it('modifie les champs non sensibles, remplace les dirigeants et ignore les champs interdits', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);

    $this->actingAs($me)->patchJson('/api/v1/me/establishments/provider/'.$p->slug, [
        'description' => 'Nouvelle description',
        'phone' => '0102030405',
        'lat' => 5.35, 'lng' => -4.0,
        'executives' => [['full_name' => 'Awa Test', 'position' => 'general_manager', 'is_visible' => true]],
        'status' => 'approved', 'is_visible' => true, 'is_featured' => true, 'is_verified' => true, 'user_id' => 1, 'reviewed_by' => 1,
    ])->assertOk()->assertJsonPath('data.description', 'Nouvelle description')->assertJsonPath('data.executives.0.full_name', 'Awa Test');

    $p->refresh();
    expect($p->status)->toBe('pending')->and($p->is_visible)->toBeFalse()->and($p->is_featured)->toBeFalse()
        ->and($p->is_verified)->toBeFalse()->and($p->user_id)->toBe($me->id)->and($p->phone)->toBe('+2250102030405');
    expect(AuditLog::where('event', 'establishment_updated')->count())->toBe(1);
});

it('refuse de modifier directement un champ sensible mais tolère la valeur identique', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me, ['rccm' => 'CI-ABJ-1']);
    $url = '/api/v1/me/establishments/provider/'.$p->slug;

    $this->actingAs($me)->patchJson($url, ['name' => 'Nouveau nom'])->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'Ce champ nécessite une demande de modification.');
    $this->actingAs($me)->patchJson($url, ['rccm' => 'CI-ABJ-2'])->assertUnprocessable();
    $this->actingAs($me)->patchJson($url, ['name' => $p->name, 'description' => 'ok'])->assertOk();
    expect($p->fresh()->name)->toBe($p->name);
});

it('valide la mise à jour', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $this->actingAs($me)->patchJson('/api/v1/me/establishments/provider/'.$p->slug, ['website_url' => 'ftp://x', 'email' => 'nope'])
        ->assertUnprocessable()->assertJsonValidationErrors(['website_url', 'email']);
});

it('interdit toute modification d\'une fiche suspendue (403)', function () {
    $me = User::factory()->create();
    $p = Provider::factory()->suspended()->create(['user_id' => $me->id, 'city_id' => City::factory()->create()->id]);
    $url = '/api/v1/me/establishments/provider/'.$p->slug;

    $this->actingAs($me)->patchJson($url, ['description' => 'x'])->assertForbidden();
    $this->actingAs($me)->postJson($url.'/change-requests', ['changes' => ['name' => 'Nouvelle Raison']])->assertForbidden();
    $this->actingAs($me)->getJson($url)->assertOk();
});

it('re-soumet une fiche rejetée uniquement', function () {
    $me = User::factory()->create();
    $admin = makeAdmin();
    $rejected = Provider::factory()->rejected()->create(['user_id' => $me->id, 'city_id' => City::factory()->create()->id]);
    $pending = pendingProviderOf($me);

    $this->actingAs($me)->postJson('/api/v1/me/establishments/provider/'.$pending->slug.'/resubmit')->assertForbidden();
    $this->actingAs($me)->postJson('/api/v1/me/establishments/provider/'.$rejected->slug.'/resubmit')->assertOk()
        ->assertJsonPath('data.status', 'pending')->assertJsonPath('data.rejection_reason', null);
    Notification::assertSentTo($admin, AdminAlert::class);
});

it('crée une demande de modification, une seule en attente, annulable', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me, ['rccm' => 'CI-ABJ-1']);
    $admin = makeAdmin();
    $url = '/api/v1/me/establishments/provider/'.$p->slug.'/change-requests';

    $res = $this->actingAs($me)->postJson($url, ['changes' => ['name' => 'Nouvelle Raison Sociale', 'rccm' => 'CI-ABJ-9']])
        ->assertCreated()->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.changes.rccm.old', 'CI-ABJ-1')->assertJsonPath('data.changes.rccm.new', 'CI-ABJ-9');
    Notification::assertSentTo($admin, AdminAlert::class, fn ($n) => $n->kind === AdminAlert::KIND_CHANGE_REQUEST_SUBMITTED);

    $this->actingAs($me)->postJson($url, ['changes' => ['name' => 'Autre Nom Demandé']])->assertStatus(409);

    // champ non sensible refusé, valeur invalide refusée
    $this->actingAs($me)->deleteJson($url.'/'.$res->json('data.id'))->assertNoContent();
    $this->actingAs($me)->postJson($url, ['changes' => ['description' => 'x']])->assertUnprocessable();
    $this->actingAs($me)->postJson($url, ['changes' => ['legal_form' => 'bidon']])->assertUnprocessable();
    $this->actingAs($me)->postJson($url, ['changes' => []])->assertUnprocessable();
    expect(ProviderChangeRequest::count())->toBe(0);
});

it('ne permet pas d\'annuler une demande déjà traitée ni celle d\'une autre fiche', function () {
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $other = pendingProviderOf($me);
    $cr = ProviderChangeRequest::create(['provider_id' => $p->id, 'requested_by' => $me->id, 'changes' => ['name' => ['old' => 'a', 'new' => 'b']]]);
    $cr->forceFill(['status' => 'approved'])->save();

    $this->actingAs($me)->deleteJson("/api/v1/me/establishments/provider/{$p->slug}/change-requests/{$cr->id}")->assertStatus(409);
    $this->actingAs($me)->deleteJson("/api/v1/me/establishments/provider/{$other->slug}/change-requests/{$cr->id}")->assertNotFound();
});

it('gère aussi une demande de modification de force étatique', function () {
    $me = User::factory()->create();
    $f = StateForce::factory()->create(['user_id' => $me->id, 'city_id' => City::factory()->create()->id]);
    $type = StateForceType::factory()->create();

    $this->actingAs($me)->postJson("/api/v1/me/establishments/state_force/{$f->slug}/change-requests", ['changes' => ['force_type_id' => $type->id]])
        ->assertCreated();
    $this->actingAs($me)->postJson("/api/v1/me/establishments/state_force/{$f->slug}/change-requests", ['changes' => ['rccm' => 'x']])->assertUnprocessable();
});
