<?php

use App\Models\AuditLog;
use App\Models\Provider;
use App\Models\User;
use App\Notifications\Quote\QuoteMail;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Notification::fake();
});

it('protège TOUTES les routes admin des devis : anonyme 401, user/provider/editor 403, admin sans 2FA 403', function () {
    $routes = [
        ['get', '/api/v1/admin/quote-requests'],
        ['get', '/api/v1/admin/quote-requests/1'],
        ['post', '/api/v1/admin/quote-requests/1/dispatch'],
        ['patch', '/api/v1/admin/quote-requests/1'],
    ];
    $noTwoFactor = User::factory()->admin()->create();

    foreach ($routes as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach ($routes as [$method, $url]) {
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), $noTwoFactor] as $actor) {
            $this->actingAs($actor)->{$method.'Json'}($url)->assertForbidden();
        }
    }
});

it('liste les devis avec filtres, recherche, tri et recipients_count', function () {
    $admin = makeAdmin();
    $p = makeProvider();
    $old = makeQuote(['first_name' => 'Zeinab', 'last_name' => 'Koné', 'email' => 'zeinab@example.com'], [$p]);
    $old->forceFill(['created_at' => now()->subDay()])->save();
    $new = makeQuote(['first_name' => 'Yao', 'last_name' => 'Kouassi', 'email' => 'yao@example.com']);

    $res = $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests')->assertOk()
        ->assertJsonStructure(['data' => [['id', 'reference', 'requester_name', 'requester_email', 'service' => ['id', 'slug', 'name'], 'city' => ['name'], 'status', 'recipients_count', 'created_at']], 'meta', 'links']);
    expect(collect($res->json('data'))->pluck('reference')->all())->toBe([$new->reference, $old->reference])
        ->and($res->json('data.1.recipients_count'))->toBe(1)->and($res->json('data.0.recipients_count'))->toBe(0)
        ->and($res->json('data.0.requester_name'))->toBe('Yao Kouassi');

    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?sort=created_at')->assertJsonPath('data.0.reference', $old->reference);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?status=sent')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $old->reference);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?q=zeinab@example')->assertJsonPath('meta.total', 1);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?q=kouassi')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $new->reference);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?q='.urlencode(substr($new->reference, 0, 8)))->assertJsonPath('meta.total', 2);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?q=%25')->assertJsonPath('meta.total', 0);
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?per_page=1')->assertJsonPath('meta.per_page', 1)->assertJsonCount(1, 'data');
    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests?status=bizarre')->assertUnprocessable();
});

it('affiche le détail complet d\'un devis avec ses destinataires', function () {
    $admin = makeAdmin();
    $p = makeProvider();
    $quote = makeQuote(['desired_start_date' => '2030-01-15'], [$p]);
    recipientOf($quote, $p)->forceFill(['status' => 'replied', 'replied_at' => now(), 'response_message' => 'Voici notre offre.', 'quoted_amount' => 500000])->save();

    $this->actingAs($admin)->getJson("/api/v1/admin/quote-requests/{$quote->id}")->assertOk()
        ->assertJsonPath('data.reference', $quote->reference)
        ->assertJsonPath('data.phone', '+2250709445111')
        ->assertJsonPath('data.company_name', 'Entrepôts Traoré')
        ->assertJsonPath('data.desired_start_date', '2030-01-15')
        ->assertJsonPath('data.recipients_count', 1)
        ->assertJsonPath('data.recipients.0.provider.id', $p->id)
        ->assertJsonPath('data.recipients.0.provider.name', $p->name)
        ->assertJsonPath('data.recipients.0.status', 'replied')
        ->assertJsonPath('data.recipients.0.quoted_amount', 500000)
        ->assertJsonStructure(['data' => ['description', 'budget_range', 'recipients' => [['id', 'sent_at', 'viewed_at', 'replied_at', 'response_message']]]]);

    $this->actingAs($admin)->getJson('/api/v1/admin/quote-requests/999999')->assertNotFound();
});

it('achemine un devis : destinataires créés, statut sent, e-mails, audit', function () {
    $admin = makeAdmin();
    [$owner, $p1] = ownerWithProvider();
    $p2 = makeProvider(['email' => 'fiche@example.com']);
    $quote = makeQuote();

    $this->actingAs($admin)->postJson("/api/v1/admin/quote-requests/{$quote->id}/dispatch", ['provider_ids' => [$p1->id, $p2->id]])
        ->assertOk()->assertJsonPath('data.status', 'sent')->assertJsonCount(2, 'data.recipients');

    expect($quote->fresh()->status)->toBe('sent')->and($quote->recipients()->where('status', 'sent')->count())->toBe(2);
    Notification::assertSentToTimes($owner, QuoteMail::class, 1);
    Notification::assertSentOnDemandTimes(QuoteMail::class, 1);
    $log = AuditLog::where('event', 'quote_dispatched')->firstOrFail();
    expect($log->user_id)->toBe($admin->id)->and($log->auditable_id)->toBe($quote->id)
        ->and($log->new_values['provider_ids'])->toEqualCanonicalizing([$p1->id, $p2->id]);
});

it('est idempotent : rejouer ou compléter ne crée aucun doublon ni e-mail superflu', function () {
    $admin = makeAdmin();
    [$owner, $p1] = ownerWithProvider();
    $p2 = makeProvider();
    $quote = makeQuote();
    $url = "/api/v1/admin/quote-requests/{$quote->id}/dispatch";

    $this->actingAs($admin)->postJson($url, ['provider_ids' => [$p1->id]])->assertOk();
    $this->actingAs($admin)->postJson($url, ['provider_ids' => [$p1->id]])->assertOk()->assertJsonCount(1, 'data.recipients');
    expect($quote->recipients()->count())->toBe(1);
    Notification::assertSentToTimes($owner, QuoteMail::class, 1);
    expect(AuditLog::where('event', 'quote_dispatched')->count())->toBe(1);

    $this->actingAs($admin)->postJson($url, ['provider_ids' => [$p1->id, $p2->id]])->assertOk()->assertJsonCount(2, 'data.recipients');
    expect($quote->recipients()->count())->toBe(2);
    Notification::assertSentToTimes($owner, QuoteMail::class, 1);
});

it('valide l\'acheminement : fiches publiées, 1 à 5, sans doublon (422), demande close = 409', function () {
    $admin = makeAdmin();
    $quote = makeQuote();
    $url = "/api/v1/admin/quote-requests/{$quote->id}/dispatch";
    $pending = Provider::factory()->pending()->create(['city_id' => makeProvider()->city_id]);
    $hidden = Provider::factory()->hidden()->create(['city_id' => makeProvider()->city_id]);
    $deleted = makeProvider();
    $deleted->delete();
    $ok = makeProvider();

    foreach ([[], ['provider_ids' => []], ['provider_ids' => [$pending->id]], ['provider_ids' => [$hidden->id]], ['provider_ids' => [$deleted->id]],
        ['provider_ids' => [999999]], ['provider_ids' => [$ok->id, $ok->id]], ['provider_ids' => 'abc'],
        ['provider_ids' => collect(range(1, 6))->map(fn () => makeProvider()->id)->all()]] as $body) {
        $this->actingAs($admin)->postJson($url, $body)->assertUnprocessable();
    }
    expect($quote->recipients()->count())->toBe(0);
    Notification::assertNothingSent();

    foreach (['closed', 'cancelled'] as $status) {
        $closed = makeQuote(['status' => $status]);
        $this->actingAs($admin)->postJson("/api/v1/admin/quote-requests/{$closed->id}/dispatch", ['provider_ids' => [$ok->id]])->assertStatus(409);
        expect($closed->recipients()->count())->toBe(0);
    }
    $this->actingAs($admin)->postJson('/api/v1/admin/quote-requests/999999/dispatch', ['provider_ids' => [$ok->id]])->assertNotFound();
});

it('change le statut avec audit, refuse un statut inconnu', function () {
    $admin = makeAdmin();
    $quote = makeQuote();
    $url = "/api/v1/admin/quote-requests/{$quote->id}";

    $this->actingAs($admin)->patchJson($url, ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
    expect($quote->fresh()->status)->toBe('closed');
    $log = AuditLog::where('event', 'quote_status_changed')->firstOrFail();
    expect($log->old_values)->toBe(['status' => 'new'])->and($log->new_values)->toBe(['status' => 'closed']);

    $this->actingAs($admin)->patchJson($url, ['status' => 'closed'])->assertOk();
    expect(AuditLog::where('event', 'quote_status_changed')->count())->toBe(1);

    foreach ([[], ['status' => 'archived'], ['status' => ['new']]] as $body) {
        $this->actingAs($admin)->patchJson($url, $body)->assertUnprocessable();
    }
    $this->actingAs($admin)->patchJson($url, ['status' => 'sent', 'reference' => 'DEV-0000-000000', 'email' => 'x@example.com'])->assertOk();
    expect($quote->fresh()->reference)->toBe($quote->reference)->and($quote->fresh()->email)->toBe('awa.traore@example.com');
    $this->actingAs($admin)->patchJson('/api/v1/admin/quote-requests/999999', ['status' => 'new'])->assertNotFound();
});
