<?php

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Notification::fake();
});

const SENT_QUOTE_KEYS = ['id', 'reference', 'service', 'city', 'district', 'description', 'desired_start_date',
    'budget_range', 'status', 'created_at', 'recipients'];

/** Devis rattaché au compte $user. */
function sentQuoteOf(User $user, array $attributes = [], array $providers = []): QuoteRequest
{
    $quote = makeQuote($attributes, $providers);
    $quote->forceFill(['user_id' => $user->id])->save();

    return $quote;
}

it('protège le suivi : anonyme 401, e-mail non vérifié 403', function () {
    $quote = sentQuoteOf(User::factory()->create());

    $urls = ['/api/v1/me/sent-quote-requests', "/api/v1/me/sent-quote-requests/{$quote->id}"];

    foreach ($urls as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach ($urls as $url) {
        $this->actingAs(User::factory()->unverified()->create())->getJson($url)->assertForbidden();
    }
});

it('liste uniquement les demandes rattachées à son compte, avec filtre et pagination', function () {
    $me = User::factory()->create();
    [, $provider] = ownerWithProvider();
    $mine = sentQuoteOf($me, [], [$provider]);
    $mine2 = sentQuoteOf($me, ['status' => 'closed']);
    $other = sentQuoteOf(User::factory()->create(), ['email' => 'autre.client@example.com']);
    $anonymous = makeQuote();

    $res = $this->actingAs($me)->getJson('/api/v1/me/sent-quote-requests')->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total'], 'links']);
    expect(collect($res->json('data'))->pluck('reference')->all())->toEqualCanonicalizing([$mine->reference, $mine2->reference])
        ->and($res->json('data.0'))->toHaveKeys(SENT_QUOTE_KEYS)
        ->and($res->getContent())->not->toContain($other->reference)->not->toContain($anonymous->reference)
        ->not->toContain('awa.traore@example.com')->not->toContain('+2250708123456');

    $this->actingAs($me)->getJson('/api/v1/me/sent-quote-requests?status=closed')->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $mine2->reference);
    $this->actingAs($me)->getJson('/api/v1/me/sent-quote-requests?per_page=1')->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($me)->getJson('/api/v1/me/sent-quote-requests?status=nimporte')->assertUnprocessable();
});

it('affiche la demande avec la réponse de chaque prestataire', function () {
    $me = User::factory()->create();
    [, $pa] = ownerWithProvider();
    [, $pb] = ownerWithProvider();
    $quote = sentQuoteOf($me, [], [$pa, $pb]);
    recipientOf($quote, $pa)->forceFill([
        'status' => 'replied', 'replied_at' => now(), 'response_message' => 'Voici notre offre.', 'quoted_amount' => 750000,
    ])->save();

    $res = $this->actingAs($me)->getJson("/api/v1/me/sent-quote-requests/{$quote->id}")->assertOk()
        ->assertJsonPath('data.reference', $quote->reference)
        ->assertJsonCount(2, 'data.recipients')
        ->assertJsonPath('data.recipients.0.provider.slug', $pa->slug)
        ->assertJsonPath('data.recipients.0.status', 'replied')
        ->assertJsonPath('data.recipients.0.quoted_amount', 750000)
        ->assertJsonPath('data.recipients.0.response_message', 'Voici notre offre.')
        ->assertJsonPath('data.recipients.1.status', 'sent');
    expect($res->json('data'))->toHaveKeys(SENT_QUOTE_KEYS)->not->toHaveKey('requester');
    // Le suivi ne marque rien comme consulté côté prestataire.
    expect(recipientOf($quote, $pb)->status)->toBe('sent');
});

it('renvoie 404 pour la demande d\'un autre utilisateur ou envoyée sans compte', function () {
    $me = User::factory()->create();
    $other = sentQuoteOf(User::factory()->create());
    $anonymous = makeQuote();

    $this->actingAs($me)->getJson("/api/v1/me/sent-quote-requests/{$other->id}")->assertNotFound();
    $this->actingAs($me)->getJson("/api/v1/me/sent-quote-requests/{$anonymous->id}")->assertNotFound();
});

it('rattache au compte une demande envoyée en étant connecté', function () {
    $me = User::factory()->create();
    $this->actingAs($me)->postJson('/api/v1/quote-requests', quotePayload())->assertCreated();

    $this->actingAs($me)->getJson('/api/v1/me/sent-quote-requests')->assertOk()->assertJsonPath('meta.total', 1);
});
