<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Provider;
use App\Models\ProviderChangeRequest;
use App\Models\ProviderDocument;
use App\Models\StateForce;
use App\Models\StateForceType;
use App\Models\User;
use App\Notifications\Establishment\EstablishmentMail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Notification::fake();
    Storage::fake('private');
    Storage::fake('public');
    config(['establishments.documents_disk' => 'private', 'establishments.media_disk' => 'public']);
});

const ADMIN_ROUTES = [
    ['get', '/api/v1/admin/dashboard'],
    ['get', '/api/v1/admin/establishments'],
    ['get', '/api/v1/admin/establishments/provider/1'],
    ['patch', '/api/v1/admin/establishments/provider/1'],
    ['post', '/api/v1/admin/establishments/provider/1/approve'],
    ['post', '/api/v1/admin/establishments/provider/1/reject'],
    ['post', '/api/v1/admin/establishments/provider/1/suspend'],
    ['post', '/api/v1/admin/establishments/provider/1/restore'],
    ['post', '/api/v1/admin/establishments/provider/1/verify'],
    ['post', '/api/v1/admin/establishments/provider/1/unverify'],
    ['delete', '/api/v1/admin/establishments/provider/1'],
    ['get', '/api/v1/admin/documents/1/download'],
    ['get', '/api/v1/admin/change-requests'],
    ['post', '/api/v1/admin/change-requests/1/approve'],
    ['post', '/api/v1/admin/change-requests/1/reject'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/reference/cities'],
    ['get', '/api/v1/admin/audit-logs'],
    ['get', '/api/v1/admin/notifications'],
];

it('protège TOUTES les routes /admin : anonyme 401, user/provider/editor 403, admin sans 2FA 403', function () {
    $noTwoFactor = User::factory()->admin()->create();

    foreach (ADMIN_ROUTES as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach (ADMIN_ROUTES as [$method, $url]) {
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor()] as $actor) {
            $this->actingAs($actor)->{$method.'Json'}($url)->assertForbidden();
        }
        $this->actingAs($noTwoFactor)->{$method.'Json'}($url)->assertForbidden();
        $this->actingAs(User::factory()->admin()->unverified()->create())->{$method.'Json'}($url)->assertForbidden();
    }
});

it('liste les établissements des deux types avec filtres et tri', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    pendingProviderOf($owner, ['name' => 'Alpha Garde']);
    Provider::factory()->create(['name' => 'Zeta Garde', 'city_id' => City::factory()->create()->id]);
    StateForce::factory()->create(['name' => 'Commissariat Bêta', 'city_id' => City::factory()->create()->id]);

    $all = $this->actingAs($admin)->getJson('/api/v1/admin/establishments')->assertOk();
    expect($all->json('meta.total'))->toBe(3)->and($all->json('data.0'))->toHaveKeys(['type', 'id', 'slug', 'name', 'status', 'is_visible', 'is_verified', 'is_featured', 'city', 'owner', 'submitted_at', 'reviewed_at']);

    expect($this->actingAs($admin)->getJson('/api/v1/admin/establishments?status=pending')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/establishments?type=state_force')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/establishments?q=alpha')->json('data.0.owner.email'))->toBe($owner->email);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/establishments?sort=name')->json('data.0.name'))->toBe('Alpha Garde');
    $this->actingAs($admin)->getJson('/api/v1/admin/establishments?status=bidon')->assertUnprocessable();
});

it('affiche le détail admin avec propriétaire et audit', function () {
    $admin = makeAdmin();
    $p = pendingProviderOf(User::factory()->create());

    $this->actingAs($admin)->getJson('/api/v1/admin/establishments/provider/'.$p->id)->assertOk()
        ->assertJsonStructure(['data' => ['id', 'owner' => ['id', 'email', 'phone'], 'is_featured', 'views_count', 'reviewed_by', 'audit', 'documents']]);
    $this->actingAs($admin)->getJson('/api/v1/admin/establishments/provider/999999')->assertNotFound();
    $this->actingAs($admin)->getJson('/api/v1/admin/establishments/bidon/1')->assertNotFound();
});

it('approuve : publie, passe le propriétaire en provider, audite, envoie UN e-mail et reste idempotent', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $p = pendingProviderOf($owner);
    $url = '/api/v1/admin/establishments/provider/'.$p->id.'/approve';

    $this->actingAs($admin)->postJson($url)->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.is_visible', true);
    $this->actingAs($admin)->postJson($url)->assertOk();

    $p->refresh();
    expect($p->status)->toBe('approved')->and($p->is_visible)->toBeTrue()->and($p->reviewed_by)->toBe($admin->id);
    expect($owner->fresh()->role)->toBe('provider');
    expect(AuditLog::where('event', 'establishment_approved')->where('user_id', $admin->id)->count())->toBe(1);
    expect(AuditLog::where('event', 'role_changed')->count())->toBe(1);
    Notification::assertSentToTimes($owner, EstablishmentMail::class, 1);
    $this->getJson('/api/v1/providers/'.$p->slug)->assertOk();
});

it('n\'écrase pas le rôle editor ou admin du propriétaire à l\'approbation', function () {
    $admin = makeAdmin();
    $editor = User::factory()->editor()->create();
    $p = pendingProviderOf($editor);
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/'.$p->id.'/approve')->assertOk();
    expect($editor->fresh()->role)->toBe('editor');
});

it('rejette avec motif, idempotent, un seul e-mail', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $p = pendingProviderOf($owner);
    $url = '/api/v1/admin/establishments/provider/'.$p->id.'/reject';

    $this->actingAs($admin)->postJson($url, ['reason' => 'court'])->assertUnprocessable();
    $this->actingAs($admin)->postJson($url, ['reason' => 'Justificatifs illisibles, merci de les renvoyer.'])->assertOk()->assertJsonPath('data.status', 'rejected')
        ->assertJsonPath('data.rejection_reason', 'Justificatifs illisibles, merci de les renvoyer.');
    $this->actingAs($admin)->postJson($url, ['reason' => 'Justificatifs illisibles, merci de les renvoyer.'])->assertOk();

    expect($p->fresh()->is_visible)->toBeFalse();
    expect(AuditLog::where('event', 'establishment_rejected')->count())->toBe(1);
    Notification::assertSentToTimes($owner, EstablishmentMail::class, 1);
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/'.$p->id.'/approve')->assertOk(); // rejetée -> approuvable
});

it('suspend puis restaure (idempotent) et refuse les transitions invalides', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $p = Provider::factory()->create(['user_id' => $owner->id, 'city_id' => City::factory()->create()->id]);
    $base = '/api/v1/admin/establishments/provider/'.$p->id;

    $this->actingAs($admin)->postJson($base.'/suspend', [])->assertUnprocessable();
    $this->actingAs($admin)->postJson($base.'/suspend', ['reason' => 'Plaintes'])->assertOk()->assertJsonPath('data.status', 'suspended');
    $this->actingAs($admin)->postJson($base.'/suspend', ['reason' => 'Plaintes'])->assertOk();
    expect($p->fresh()->is_visible)->toBeFalse();
    Notification::assertSentToTimes($owner, EstablishmentMail::class, 1);
    $this->actingAs($admin)->postJson($base.'/approve')->assertStatus(409);
    $this->actingAs($admin)->postJson($base.'/reject', ['reason' => 'Motif suffisamment long'])->assertStatus(409);

    $this->actingAs($admin)->postJson($base.'/restore')->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.is_visible', true);
    $this->actingAs($admin)->postJson($base.'/restore')->assertOk();
    expect(AuditLog::where('event', 'establishment_restored')->count())->toBe(1);
    $this->actingAs($admin)->postJson($base.'/suspend', ['reason' => 'x'])->assertUnprocessable();
});

it('vérifie et retire le badge, prestataires uniquement', function () {
    $admin = makeAdmin();
    $p = Provider::factory()->create(['city_id' => City::factory()->create()->id]);
    $f = StateForce::factory()->create(['city_id' => City::factory()->create()->id]);

    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/'.$p->id.'/verify')->assertOk();
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/'.$p->id.'/verify')->assertOk();
    expect($p->fresh()->is_verified)->toBeTrue()->and($p->fresh()->verified_at)->not->toBeNull();
    expect(AuditLog::where('event', 'establishment_verified')->count())->toBe(1);
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/'.$p->id.'/unverify')->assertOk();
    expect($p->fresh()->is_verified)->toBeFalse();
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/state_force/'.$f->id.'/verify')->assertUnprocessable();
});

it('modifie tous les champs y compris sensibles et is_featured, en auditant les noms de champs', function () {
    $admin = makeAdmin();
    $p = pendingProviderOf(User::factory()->create(), ['rccm' => 'ANCIEN-1']);

    $this->actingAs($admin)->patchJson('/api/v1/admin/establishments/provider/'.$p->id, [
        'name' => 'Nom Corrigé', 'rccm' => 'CI-ABJ-2026-X', 'is_featured' => true, 'lat' => 5.31, 'lng' => -4.02, 'status' => 'approved',
    ])->assertOk()->assertJsonPath('data.name', 'Nom Corrigé')->assertJsonPath('data.is_featured', true);

    $p->refresh();
    expect($p->rccm)->toBe('CI-ABJ-2026-X')->and($p->is_featured)->toBeTrue()->and($p->status)->toBe('pending');
    $log = AuditLog::where('event', 'establishment_updated_by_admin')->firstOrFail();
    expect($log->context['fields'])->toContain('rccm')->and(json_encode($log->toArray()))->not->toContain('CI-ABJ-2026-X');
    $this->actingAs($admin)->patchJson('/api/v1/admin/establishments/provider/'.$p->id, ['lat' => 500, 'lng' => 1])->assertUnprocessable();
});

it('supprime logiquement avec confirm_name exact', function () {
    $admin = makeAdmin();
    $p = Provider::factory()->create(['name' => 'Fiche À Supprimer', 'city_id' => City::factory()->create()->id]);
    $url = '/api/v1/admin/establishments/provider/'.$p->id;

    $this->actingAs($admin)->deleteJson($url)->assertUnprocessable();
    $this->actingAs($admin)->deleteJson($url, ['confirm_name' => 'fiche à supprimer'])->assertUnprocessable();
    $this->actingAs($admin)->deleteJson($url, ['confirm_name' => 'Fiche À Supprimer'])->assertNoContent();

    expect(Provider::withTrashed()->find($p->id)->deleted_at)->not->toBeNull();
    $this->getJson('/api/v1/providers/'.$p->slug)->assertNotFound();
    expect(AuditLog::where('event', 'establishment_deleted')->count())->toBe(1);
    $this->actingAs($admin)->getJson($url)->assertNotFound();
});

it('télécharge un justificatif privé en pièce jointe et journalise chaque accès', function () {
    $admin = makeAdmin();
    $me = User::factory()->create();
    $p = pendingProviderOf($me);
    $doc = ProviderDocument::query()->create(['provider_id' => $p->id, 'type' => 'rccm_extract', 'disk' => 'private', 'path' => 'documents/provider/1/x.pdf', 'original_name' => 'a.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 12]);
    Storage::disk('private')->put($doc->path, "%PDF-1.4\n%%EOF");

    // jamais accessible sans auth ni par le propriétaire
    $this->getJson('/api/v1/admin/documents/'.$doc->id.'/download')->assertUnauthorized();
    $this->actingAs($me)->getJson('/api/v1/admin/documents/'.$doc->id.'/download')->assertForbidden();

    foreach ([1, 2] as $_) {
        $res = $this->actingAs($admin)->get('/api/v1/admin/documents/'.$doc->id.'/download')->assertOk();
        expect($res->headers->get('Content-Disposition'))->toStartWith('attachment')
            ->and($res->headers->get('Content-Type'))->toBe('application/pdf')
            ->and($res->headers->get('X-Content-Type-Options'))->toBe('nosniff');
    }
    expect(AuditLog::where('event', 'document_downloaded')->where('user_id', $admin->id)->count())->toBe(2);
    $this->actingAs($admin)->getJson('/api/v1/admin/documents/999999/download')->assertNotFound();
});

it('liste, approuve (idempotent, e-mail unique) et rejette les demandes de modification', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $p = pendingProviderOf($owner, ['rccm' => 'ANCIEN']);
    $cr = ProviderChangeRequest::create(['provider_id' => $p->id, 'requested_by' => $owner->id, 'changes' => [
        'name' => ['old' => $p->name, 'new' => 'Nouvelle Raison'], 'rccm' => ['old' => 'ANCIEN', 'new' => 'NOUVEAU'],
        'status' => ['old' => 'pending', 'new' => 'approved'], // champ non whitelisté : jamais appliqué
    ]]);

    $list = $this->actingAs($admin)->getJson('/api/v1/admin/change-requests')->assertOk();
    expect($list->json('data.0'))->toMatchArray(['id' => $cr->id, 'type' => 'provider', 'status' => 'pending'])
        ->and($list->json('data.0.establishment.id'))->toBe($p->id);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/change-requests?status=approved')->json('meta.total'))->toBe(0);

    $this->actingAs($admin)->postJson("/api/v1/admin/change-requests/{$cr->id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
    $this->actingAs($admin)->postJson("/api/v1/admin/change-requests/{$cr->id}/approve")->assertOk();

    $p->refresh();
    expect($p->name)->toBe('Nouvelle Raison')->and($p->rccm)->toBe('NOUVEAU')->and($p->status)->toBe('pending');
    expect(AuditLog::where('event', 'change_request_approved')->count())->toBe(1);
    Notification::assertSentToTimes($owner, EstablishmentMail::class, 1);
    $this->actingAs($admin)->postJson("/api/v1/admin/change-requests/{$cr->id}/reject", ['reason' => 'Motif suffisamment long'])->assertStatus(409);
});

it('rejette une demande de modification (motif requis, idempotent)', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $p = pendingProviderOf($owner);
    $cr = ProviderChangeRequest::create(['provider_id' => $p->id, 'requested_by' => $owner->id, 'changes' => ['name' => ['old' => 'a', 'new' => 'b']]]);
    $url = "/api/v1/admin/change-requests/{$cr->id}/reject";

    $this->actingAs($admin)->postJson($url, [])->assertUnprocessable();
    $this->actingAs($admin)->postJson($url, ['reason' => 'Pièces justificatives manquantes'])->assertOk()->assertJsonPath('data.status', 'rejected');
    $this->actingAs($admin)->postJson($url, ['reason' => 'Pièces justificatives manquantes'])->assertOk();
    expect($p->fresh()->name)->not->toBe('b');
    Notification::assertSentToTimes($owner, EstablishmentMail::class, 1);
    $this->actingAs($admin)->postJson('/api/v1/admin/change-requests/999999/approve')->assertNotFound();
});

it('applique une demande de modification de force étatique', function () {
    $admin = makeAdmin();
    $owner = User::factory()->create();
    $f = StateForce::factory()->create(['user_id' => $owner->id, 'city_id' => City::factory()->create()->id]);
    $type = StateForceType::factory()->create();
    $cr = ProviderChangeRequest::create(['state_force_id' => $f->id, 'requested_by' => $owner->id, 'changes' => ['force_type_id' => ['old' => $f->force_type_id, 'new' => $type->id]]]);

    $this->actingAs($admin)->postJson("/api/v1/admin/change-requests/{$cr->id}/approve")->assertOk()->assertJsonPath('data.type', 'state_force');
    expect($f->fresh()->force_type_id)->toBe($type->id);
});
