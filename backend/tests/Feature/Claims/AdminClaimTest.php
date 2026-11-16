<?php

use App\Models\AuditLog;
use App\Models\EstablishmentClaim;
use App\Models\Provider;
use App\Models\User;
use App\Notifications\Claims\ClaimMail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Storage::fake('private');
    config(['establishments.documents_disk' => 'private']);
    Notification::fake();
});

/** Dépose une demande via l'API (circuit complet) et la renvoie. */
function submitClaim(User $user, Provider $provider): EstablishmentClaim
{
    test()->actingAs($user)->post(claimUrl($provider), claimPayload(), ['Accept' => 'application/json'])->assertCreated();

    return EstablishmentClaim::query()->where('user_id', $user->id)->where('provider_id', $provider->id)->latest('id')->firstOrFail();
}

it('protège toutes les routes admin : 401 anonyme, 403 utilisateur, éditeur et admin sans 2FA', function () {
    $claim = submitClaim(User::factory()->create(), makeProvider());
    $provider = makeProvider();
    $calls = [
        ['getJson', '/api/v1/admin/claims', []],
        ['getJson', '/api/v1/admin/claims/'.$claim->id, []],
        ['getJson', '/api/v1/admin/claims/'.$claim->id.'/document', []],
        ['postJson', '/api/v1/admin/claims/'.$claim->id.'/approve', []],
        ['postJson', '/api/v1/admin/claims/'.$claim->id.'/reject', ['reason' => 'Justificatif illisible.']],
        ['postJson', '/api/v1/admin/establishments/provider/'.$provider->id.'/owner', ['email' => 'x@example.test']],
    ];

    foreach ($calls as [$method, $url, $body]) {
        app('auth')->forgetGuards();
        $this->{$method}($url, $body)->assertUnauthorized();
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $who) {
            $this->actingAs($who)->{$method}($url, $body)->assertForbidden();
        }
    }
    expect($claim->fresh()->status)->toBe('pending')->and($provider->fresh()->user_id)->toBeNull();
});

it('liste les demandes en attente par défaut et affiche le détail AdminClaim', function () {
    $admin = makeAdmin();
    $user = User::factory()->create(['first_name' => 'Awa', 'last_name' => 'Koné']);
    $claim = submitClaim($user, makeProvider());
    $rejected = submitClaim(User::factory()->create(), makeProvider());
    $rejected->forceFill(['status' => 'rejected', 'rejection_reason' => 'Motif de test suffisant.'])->save();

    $this->actingAs($admin)->getJson('/api/v1/admin/claims')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $claim->id)->assertJsonPath('meta.total', 1);
    $this->actingAs($admin)->getJson('/api/v1/admin/claims?status=rejected')->assertOk()->assertJsonPath('data.0.id', $rejected->id);
    $this->actingAs($admin)->getJson('/api/v1/admin/claims?status=autre')->assertUnprocessable();

    $d = $this->actingAs($admin)->getJson('/api/v1/admin/claims/'.$claim->id)->assertOk()->json('data');
    expect(array_keys($d))->toEqualCanonicalizing(['id', 'status', 'establishment', 'user', 'submitter_role', 'phone', 'message', 'document', 'rejection_reason', 'reviewer', 'created_at', 'reviewed_at'])
        ->and(array_keys($d['establishment']))->toEqualCanonicalizing(['type', 'id', 'slug', 'name', 'city'])
        ->and($d['user'])->toBe(['id' => $user->id, 'name' => 'Awa Koné', 'email' => $user->email])
        ->and($d['phone'])->toBe('+2250709445111')
        ->and($d['document'])->toBe(['name' => 'extrait-rccm.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => $claim->document_size_bytes]);
    $this->actingAs($admin)->getJson('/api/v1/admin/claims/999999')->assertNotFound();
});

it('télécharge le justificatif en pièce jointe et journalise l\'accès', function () {
    $admin = makeAdmin();
    $claim = submitClaim(User::factory()->create(), makeProvider());

    $res = $this->actingAs($admin)->get('/api/v1/admin/claims/'.$claim->id.'/document')->assertOk();
    expect($res->headers->get('Content-Disposition'))->toContain('attachment')->toContain('revendication-'.$claim->id.'.pdf')
        ->and($res->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($res->streamedContent())->toStartWith('%PDF-');
    $log = AuditLog::where('event', 'claim_document_downloaded')->sole();
    expect($log->context)->toBe(['claim_id' => $claim->id]);
});

it('accepte : propriétaire posé, rôle provider, autres demandes refusées, e-mails, audit ; idempotent', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $winner = User::factory()->create();
    $loser = User::factory()->create();
    $claim = submitClaim($winner, $provider);
    $other = submitClaim($loser, $provider);
    Notification::fake();

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/approve')->assertOk()
        ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.reviewer.id', $admin->id);

    expect($provider->fresh()->user_id)->toBe($winner->id)
        ->and($winner->fresh()->role)->toBe(User::ROLE_PROVIDER)
        ->and($other->fresh()->status)->toBe('rejected')
        ->and($other->fresh()->rejection_reason)->toBe('Fiche attribuée à un autre compte.')
        ->and($other->fresh()->document_path)->toBeNull();
    Storage::disk('private')->assertMissing($other->document_path);
    Storage::disk('private')->assertExists($claim->document_path);

    Notification::assertSentToTimes($winner, ClaimMail::class, 1);
    Notification::assertSentTo($winner, ClaimMail::class, fn (ClaimMail $m) => $m->event === ClaimMail::APPROVED);
    Notification::assertSentTo($loser, ClaimMail::class, fn (ClaimMail $m) => $m->event === ClaimMail::REJECTED && $m->reason === 'Fiche attribuée à un autre compte.');
    expect(AuditLog::where('event', 'claim_approved')->count())->toBe(1)
        ->and(AuditLog::where('event', 'claim_rejected')->count())->toBe(1);

    // Rejeu : rien ne change, aucun e-mail ni audit supplémentaire.
    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/approve')->assertOk()->assertJsonPath('data.status', 'approved');
    Notification::assertSentToTimes($winner, ClaimMail::class, 1);
    expect(AuditLog::where('event', 'claim_approved')->count())->toBe(1);

    // La fiche n'est plus revendicable.
    $this->getJson('/api/v1/providers/'.$provider->slug)->assertJsonPath('data.is_claimable', false);
});

it('ne rétrograde jamais un administrateur ou un éditeur propriétaire', function () {
    $admin = makeAdmin();
    $editor = User::factory()->editor()->create();
    $claim = submitClaim($editor, makeProvider());

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/approve')->assertOk();
    expect($editor->fresh()->role)->toBe(User::ROLE_EDITOR);
});

it('renvoie 409 si la fiche a entre-temps un propriétaire (course entre deux acceptations)', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $first = submitClaim(User::factory()->create(), $provider);
    $second = submitClaim(User::factory()->create(), $provider);

    // La seconde demande est remise « en attente » artificiellement comme si deux administrateurs agissaient en parallèle.
    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$first->id.'/approve')->assertOk();
    EstablishmentClaim::query()->whereKey($second->id)->update(['status' => 'pending', 'rejection_reason' => null]);

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$second->id.'/approve')
        ->assertStatus(409)->assertJsonPath('message', 'Cette fiche est déjà gérée par un compte.');
    expect($provider->fresh()->user_id)->toBe($first->user_id)->and($second->fresh()->status)->toBe('pending');
});

it('refuse : motif ≥ 10, justificatif supprimé, e-mail, audit ; idempotent ; plus acceptable ensuite', function () {
    $admin = makeAdmin();
    $user = User::factory()->create();
    $claim = submitClaim($user, makeProvider());
    $path = $claim->document_path;
    Notification::fake();

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/reject', ['reason' => 'Court'])
        ->assertUnprocessable()->assertJsonValidationErrors('reason');

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/reject', ['reason' => 'Le justificatif est illisible.'])->assertOk()
        ->assertJsonPath('data.status', 'rejected')->assertJsonPath('data.rejection_reason', 'Le justificatif est illisible.')
        ->assertJsonPath('data.document', null);
    Storage::disk('private')->assertMissing($path);
    Notification::assertSentToTimes($user, ClaimMail::class, 1);
    Notification::assertSentTo($user, ClaimMail::class, fn (ClaimMail $m) => $m->event === ClaimMail::REJECTED);
    expect(AuditLog::where('event', 'claim_rejected')->count())->toBe(1);

    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/reject', ['reason' => 'Autre motif suffisamment long.'])->assertOk()
        ->assertJsonPath('data.rejection_reason', 'Le justificatif est illisible.');
    Notification::assertSentToTimes($user, ClaimMail::class, 1);
    $this->actingAs($admin)->get('/api/v1/admin/claims/'.$claim->id.'/document')->assertNotFound();
    $this->actingAs($admin)->postJson('/api/v1/admin/claims/'.$claim->id.'/approve')->assertStatus(409);

    // Après un refus, le compte peut déposer une nouvelle demande.
    $this->actingAs($user)->post(claimUrl(Provider::findOrFail($claim->provider_id)), claimPayload(), ['Accept' => 'application/json'])->assertCreated();
});

it('attribue une fiche par e-mail : 422 compte inconnu, 200 avec rôle, audit, e-mail ; 409 si déjà gérée', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $target = User::factory()->create(['email' => 'gerant@example.test']);
    $pending = submitClaim(User::factory()->create(), $provider);
    $url = '/api/v1/admin/establishments/provider/'.$provider->id.'/owner';
    Notification::fake();

    $this->actingAs($admin)->postJson($url, ['email' => 'inconnu@example.test'])
        ->assertUnprocessable()->assertJsonPath('errors.email.0', 'Aucun compte actif avec cet e-mail.');
    $inactive = User::factory()->inactive()->create();
    $this->actingAs($admin)->postJson($url, ['email' => $inactive->email])->assertUnprocessable();

    $this->actingAs($admin)->postJson($url, ['email' => ' GERANT@example.test '])->assertOk()
        ->assertJsonPath('data.owner.id', $target->id);
    expect($provider->fresh()->user_id)->toBe($target->id)
        ->and($target->fresh()->role)->toBe(User::ROLE_PROVIDER)
        ->and($pending->fresh()->status)->toBe('rejected');
    $log = AuditLog::where('event', 'establishment_owner_assigned')->sole();
    expect(json_encode([$log->old_values, $log->new_values, $log->context]))->not->toContain('gerant@');
    Notification::assertSentTo($target, ClaimMail::class, fn (ClaimMail $m) => $m->event === ClaimMail::APPROVED);

    $this->actingAs($admin)->postJson($url, ['email' => User::factory()->create()->email])
        ->assertStatus(409)->assertJsonPath('message', 'Cette fiche est déjà gérée par un compte.');
    $this->actingAs($admin)->postJson('/api/v1/admin/establishments/provider/999999/owner', ['email' => $target->email])->assertNotFound();
});

it('compte les demandes en attente dans le tableau de bord', function () {
    $admin = makeAdmin();
    submitClaim(User::factory()->create(), makeProvider());
    submitClaim(User::factory()->create(), makeProvider());

    $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.pending_claims', 2);
});

it('efface téléphone, message et justificatif des demandes à l\'anonymisation du compte', function () {
    $admin = makeAdmin();
    $user = User::factory()->create();
    $claim = submitClaim($user, makeProvider());
    $path = $claim->document_path;

    $this->actingAs($admin)->postJson('/api/v1/admin/users/'.$user->id.'/anonymize', ['confirm_email' => $user->email])->assertSuccessful();

    $fresh = $claim->fresh();
    expect($fresh->user_id)->toBeNull()->and($fresh->phone)->toBe('')->and($fresh->message)->toBeNull()
        ->and($fresh->document_path)->toBeNull()->and($fresh->status)->toBe('rejected');
    Storage::disk('private')->assertMissing($path);
});
