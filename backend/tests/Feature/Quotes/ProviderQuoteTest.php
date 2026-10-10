<?php

use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\QuoteRequestRecipient;
use App\Models\User;
use App\Notifications\Quote\QuoteMail;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Notification::fake();
});

const PROVIDER_QUOTE_KEYS = ['id', 'reference', 'provider', 'requester', 'service', 'city', 'district', 'description', 'desired_start_date',
    'budget_range', 'status', 'sent_at', 'viewed_at', 'replied_at', 'response_message', 'quoted_amount'];

/** Deux prestataires, chacun avec son devis. @return array{0: User, 1: Provider, 2: QuoteRequest, 3: User, 4: Provider, 5: QuoteRequest} */
function twoInboxes(): array
{
    [$ownerA, $pa] = ownerWithProvider();
    [$ownerB, $pb] = ownerWithProvider();

    return [$ownerA, $pa, makeQuote([], [$pa]), $ownerB, $pb, makeQuote(['email' => 'autre.client@example.com', 'phone' => '+2250102030405'], [$pb])];
}

it('protège la boîte : anonyme 401, e-mail non vérifié 403, utilisateur sans fiche 403', function () {
    [, , $quote] = twoInboxes();
    $id = $quote->recipients()->value('id');
    $routes = [['get', '/api/v1/me/quote-requests'], ['get', "/api/v1/me/quote-requests/$id"],
        ['post', "/api/v1/me/quote-requests/$id/reply"], ['post', "/api/v1/me/quote-requests/$id/decline"]];

    foreach ($routes as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach ($routes as [$method, $url]) {
        $this->actingAs(User::factory()->provider()->unverified()->create())->{$method.'Json'}($url)->assertForbidden();
        $this->actingAs(User::factory()->create())->{$method.'Json'}($url, ['message' => 'Bonjour, voici notre offre.'])->assertForbidden();
    }
    // Fiche supprimée : plus de boîte.
    [$owner, $provider] = ownerWithProvider();
    $provider->delete();
    $this->actingAs($owner)->getJson('/api/v1/me/quote-requests')->assertForbidden();
});

it('liste uniquement les devis adressés à ses fiches, avec filtre et pagination', function () {
    [$ownerA, $pa, $qa, , , $qb] = twoInboxes();
    $second = makeProvider(['user_id' => $ownerA->id]);
    $qa2 = makeQuote([], [$second]);
    recipientOf($qa2, $second)->forceFill(['status' => 'replied'])->save();

    $res = $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests')->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total'], 'links']);
    expect(collect($res->json('data'))->pluck('reference')->all())->toEqualCanonicalizing([$qa->reference, $qa2->reference])
        ->and($res->json('data.0'))->toHaveKeys(PROVIDER_QUOTE_KEYS)
        ->and($res->json('meta.total'))->toBe(2);
    expect($res->getContent())->not->toContain($qb->reference)->not->toContain('autre.client@example.com');

    $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests?status=replied')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $qa2->reference);
    $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests?per_page=1')->assertOk()->assertJsonPath('meta.per_page', 1)->assertJsonCount(1, 'data');
    $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests?status=nimporte')->assertUnprocessable();
});

it('affiche le devis avec les coordonnées du demandeur et passe à viewed (idempotent)', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $id = recipientOf($qa, $pa)->id;

    $first = $this->actingAs($ownerA)->getJson("/api/v1/me/quote-requests/$id")->assertOk()
        ->assertJsonPath('data.id', $id)
        ->assertJsonPath('data.status', 'viewed')
        ->assertJsonPath('data.provider.slug', $pa->slug)
        ->assertJsonPath('data.requester.name', 'Awa Traoré')
        ->assertJsonPath('data.requester.email', 'awa.traore@example.com')
        ->assertJsonPath('data.requester.phone', '+2250709445111')
        ->assertJsonPath('data.requester.company_name', 'Entrepôts Traoré');
    expect($first->json('data'))->toHaveKeys(PROVIDER_QUOTE_KEYS)->and($first->json('data.viewed_at'))->not->toBeNull();

    $viewedAt = recipientOf($qa, $pa)->viewed_at;
    $this->travel(5)->minutes();
    $this->actingAs($ownerA)->getJson("/api/v1/me/quote-requests/$id")->assertOk()->assertJsonPath('data.status', 'viewed');
    expect(recipientOf($qa, $pa)->viewed_at?->equalTo($viewedAt))->toBeTrue();
});

it('ne rétrograde jamais replied ni declined à la consultation', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $r = recipientOf($qa, $pa);
    $r->forceFill(['status' => 'replied', 'replied_at' => now()])->save();

    $this->actingAs($ownerA)->getJson("/api/v1/me/quote-requests/{$r->id}")->assertOk()->assertJsonPath('data.status', 'replied');
    $r->forceFill(['status' => 'declined'])->save();
    $this->actingAs($ownerA)->getJson("/api/v1/me/quote-requests/{$r->id}")->assertOk()->assertJsonPath('data.status', 'declined');
});

it('renvoie 404 pour un devis adressé à un autre prestataire ou inexistant, sans rien modifier', function () {
    [$ownerA, , , , $pb, $qb] = twoInboxes();
    $idB = recipientOf($qb, $pb)->id;

    $this->actingAs($ownerA)->getJson("/api/v1/me/quote-requests/$idB")->assertNotFound();
    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$idB/reply", ['message' => 'Voici notre offre détaillée.'])->assertNotFound();
    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$idB/decline")->assertNotFound();
    $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests/999999')->assertNotFound();

    expect(QuoteRequestRecipient::find($idB)->status)->toBe('sent');
    Notification::assertNothingSent();
});

it('répond au devis : destinataire replied, demande answered, e-mail au demandeur, une seule réponse', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $id = recipientOf($qa, $pa)->id;

    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/reply", [
        'message' => 'Bonjour, voici notre <b>proposition</b> [cliquez](http://pirate.example)', 'quoted_amount' => 750000,
        'status' => 'declined',
    ])->assertOk()->assertJsonPath('data.status', 'replied')->assertJsonPath('data.quoted_amount', 750000);

    $r = recipientOf($qa, $pa);
    expect($r->status)->toBe('replied')->and($r->replied_at)->not->toBeNull()->and($r->quoted_amount)->toBe(750000)
        ->and($r->response_message)->toBe('Bonjour, voici notre proposition [cliquez](http://pirate.example)')
        ->and($qa->fresh()->status)->toBe('answered');

    Notification::assertSentOnDemandTimes(QuoteMail::class, 1);
    Notification::assertSentOnDemand(QuoteMail::class, function (QuoteMail $n, $c, $notifiable) {
        $html = (string) $n->toMail($notifiable)->render();

        return $n->event === QuoteMail::REPLIED && $notifiable->routes['mail'] === 'awa.traore@example.com'
            && str_contains($html, '750 000 FCFA') && ! str_contains($html, 'href="http://pirate.example') && ! str_contains($html, '<b>');
    });

    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/reply", ['message' => 'Seconde réponse tentée.'])->assertStatus(409);
    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/decline")->assertStatus(409);
    Notification::assertSentOnDemandTimes(QuoteMail::class, 1);
});

it('valide la réponse (422)', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $id = recipientOf($qa, $pa)->id;

    foreach ([[], ['message' => 'court'], ['message' => str_repeat('a', 3001)], ['message' => 'Un message valable.', 'quoted_amount' => -1],
        ['message' => 'Un message valable.', 'quoted_amount' => 'beaucoup'], ['message' => 'Un message valable.', 'quoted_amount' => 10.5]] as $body) {
        $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/reply", $body)->assertUnprocessable();
    }
    expect(recipientOf($qa, $pa)->status)->toBe('sent');

    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/reply", ['message' => 'Un message valable.', 'quoted_amount' => 0])->assertOk();
});

it('refuse de répondre à une demande close ou annulée (409)', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $qa->forceFill(['status' => 'cancelled'])->save();

    $this->actingAs($ownerA)->postJson('/api/v1/me/quote-requests/'.recipientOf($qa, $pa)->id.'/reply', ['message' => 'Un message valable.'])->assertStatus(409);
    Notification::assertNothingSent();
});

it('refuse un devis : motif stocké, idempotent, aucun e-mail, 409 après une réponse', function () {
    [$ownerA, $pa, $qa] = twoInboxes();
    $id = recipientOf($qa, $pa)->id;

    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/decline", ['reason' => 'Hors de notre <i>zone</i>'])
        ->assertOk()->assertJsonPath('data.status', 'declined')->assertJsonPath('data.response_message', 'Hors de notre zone');
    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/decline", ['reason' => 'Autre motif'])
        ->assertOk()->assertJsonPath('data.response_message', 'Hors de notre zone');

    expect(recipientOf($qa, $pa)->replied_at)->toBeNull()->and($qa->fresh()->status)->toBe('sent');
    $this->actingAs($ownerA)->postJson("/api/v1/me/quote-requests/$id/reply", ['message' => 'Finalement, voici une offre.'])->assertStatus(409);
    Notification::assertNothingSent();

    [, , , $ownerB, $pb, $qb] = twoInboxes();
    $idB = recipientOf($qb, $pb)->id;
    $this->actingAs($ownerB)->postJson("/api/v1/me/quote-requests/$idB/decline", ['reason' => str_repeat('a', 501)])->assertUnprocessable();
    $this->actingAs($ownerB)->postJson("/api/v1/me/quote-requests/$idB/decline")->assertOk()->assertJsonPath('data.response_message', null);

    $replied = makeQuote([], [$pb]);
    $rid = recipientOf($replied, $pb)->id;
    $this->actingAs($ownerB)->postJson("/api/v1/me/quote-requests/$rid/reply", ['message' => 'Voici notre offre détaillée.'])->assertOk();
    $this->actingAs($ownerB)->postJson("/api/v1/me/quote-requests/$rid/decline")->assertStatus(409);
});

it('un prestataire ne voit jamais les coordonnées d\'un demandeur adressées à un autre', function () {
    [$ownerA, , , $ownerB] = twoInboxes();

    $a = $this->actingAs($ownerA)->getJson('/api/v1/me/quote-requests')->getContent();
    $b = $this->actingAs($ownerB)->getJson('/api/v1/me/quote-requests')->getContent();

    expect($a)->not->toContain('autre.client@example.com')->not->toContain('+2250102030405')
        ->and($b)->not->toContain('awa.traore@example.com')->not->toContain('+2250709445111');
});

it('un admin non propriétaire de fiche n\'a pas de boîte prestataire', function () {
    $this->actingAs(makeAdmin())->getJson('/api/v1/me/quote-requests')->assertForbidden();
});
