<?php

use App\Models\ConsentLog;
use App\Models\District;
use App\Models\IdempotencyKey;
use App\Models\Provider;
use App\Models\QuoteRequest;
use App\Models\ServiceType;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Quote\QuoteMail;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    Notification::fake();
    RateLimiter::clear('x');
});

const QUOTE_URL = '/api/v1/quote-requests';

it('crée un devis anonyme (statut new), trace le consentement et envoie accusé + alerte admin', function () {
    $admin = makeAdmin();

    $res = $this->postJson(QUOTE_URL, quotePayload([
        'description' => 'Nous cherchons un <b>gardiennage</b> de nuit pour un entrepôt de 2000 m².',
        'status' => 'answered', 'user_id' => 999, 'assigned_to' => 1,
    ]))->assertCreated();

    expect($res->json('data.reference'))->toMatch('/^DEV-\d{4}-\d{6}$/')
        ->and($res->json('data.message'))->toBeString();

    $quote = QuoteRequest::query()->firstOrFail();
    expect($quote->reference)->toBe($res->json('data.reference'))
        ->and($quote->user_id)->toBeNull()
        ->and($quote->status)->toBe('new')
        ->and($quote->assigned_to ?? null)->toBeNull()
        ->and($quote->phone)->toBe('+2250709445111')
        ->and($quote->description)->toBe('Nous cherchons un gardiennage de nuit pour un entrepôt de 2000 m².')
        ->and($quote->consent_at)->not->toBeNull()
        ->and($quote->recipients()->count())->toBe(0);
    expect(strlen((string) QuoteRequest::query()->toBase()->value('ip_hash')))->toBe(64);
    expect(ConsentLog::where('purpose', 'quote')->where('email', 'awa.traore@example.com')->count())->toBe(1);

    Notification::assertSentOnDemandTimes(QuoteMail::class, 1);
    Notification::assertSentOnDemand(QuoteMail::class, fn (QuoteMail $n, $channels, $notifiable) => $n->event === QuoteMail::ACKNOWLEDGED
        && $notifiable->routes['mail'] === 'awa.traore@example.com');
    Notification::assertSentTo($admin, AdminAlert::class, fn (AdminAlert $a) => $a->kind === AdminAlert::KIND_QUOTE_REQUESTED
        && $a->subject === ['type' => 'quote_request', 'id' => $quote->id, 'reference' => $quote->reference]);
});

it('rattache le devis au compte connecté', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(QUOTE_URL, quotePayload())->assertCreated();

    expect(QuoteRequest::query()->firstOrFail()->user_id)->toBe($user->id);
    expect(ConsentLog::where('purpose', 'quote')->first()->user_id)->toBe($user->id);
});

it('crée un destinataire par prestataire publié, statut sent, et prévient chacun sans texte libre ni coordonnées', function () {
    [$owner, $p1] = ownerWithProvider();
    $p2 = makeProvider(['email' => 'contact@prestataire-sans-compte.example']);

    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => [$p1->slug, $p2->slug]]))->assertCreated();

    $quote = QuoteRequest::query()->firstOrFail();
    expect($quote->status)->toBe('sent')
        ->and($quote->recipients()->count())->toBe(2)
        ->and($quote->recipients()->where('status', 'sent')->whereNotNull('sent_at')->count())->toBe(2);

    Notification::assertSentTo($owner, QuoteMail::class, function (QuoteMail $n) use ($owner, $quote) {
        $html = (string) $n->toMail($owner)->render();

        return $n->event === QuoteMail::RECEIVED
            && str_contains($html, $quote->reference)
            && ! str_contains($html, 'Awa') && ! str_contains($html, '2250709445111')
            && ! str_contains($html, 'entrepôt') && ! str_contains($html, 'awa.traore@example.com');
    });
    Notification::assertSentOnDemand(QuoteMail::class, fn (QuoteMail $n, $c, $notifiable) => $n->event === QuoteMail::RECEIVED
        && $notifiable->routes['mail'] === 'contact@prestataire-sans-compte.example');
    Notification::assertSentOnDemandTimes(QuoteMail::class, 2); // accusé + prestataire sans compte
    Notification::assertSentToTimes($owner, QuoteMail::class, 1);
});

it('refuse les fiches non publiées, inconnues, en double ou trop nombreuses (422, rien d\'enregistré)', function () {
    $pending = Provider::factory()->pending()->create(['city_id' => makeProvider()->city_id]);
    $hidden = Provider::factory()->hidden()->create(['city_id' => makeProvider()->city_id]);
    $ok = makeProvider();

    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => [$pending->slug]]))->assertUnprocessable()->assertJsonValidationErrors(['provider_slugs.0']);
    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => [$hidden->slug]]))->assertUnprocessable();
    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => ['inconnu-total']]))->assertUnprocessable();
    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => [$ok->slug, $ok->slug]]))->assertUnprocessable();
    $six = collect(range(1, 6))->map(fn () => makeProvider()->slug)->all();
    $this->postJson(QUOTE_URL, quotePayload(['provider_slugs' => $six]))->assertUnprocessable()->assertJsonValidationErrors(['provider_slugs']);

    expect(QuoteRequest::count())->toBe(0);
    Notification::assertNothingSent();
});

it('valide les champs en liste blanche', function () {
    $this->postJson(QUOTE_URL, [])->assertUnprocessable()->assertJsonValidationErrors(
        ['first_name', 'last_name', 'email', 'phone', 'service_type_id', 'city_id', 'description', 'consent']
    );

    $invisibleService = ServiceType::factory()->create(['is_visible' => false]);
    $otherCityDistrict = District::factory()->create();
    $cases = [
        ['phone' => '123', 'phone'],
        ['email' => 'pas-un-email', 'email'],
        ['description' => 'Trop court', 'description'],
        ['description' => str_repeat('a', 3001), 'description'],
        ['desired_start_date' => now()->subDay()->format('Y-m-d'), 'desired_start_date'],
        ['budget_range' => str_repeat('a', 51), 'budget_range'],
        ['service_type_id' => $invisibleService->id, 'service_type_id'],
        ['city_id' => 999999, 'city_id'],
        ['district_id' => $otherCityDistrict->id, 'district_id'],
        ['consent' => false, 'consent'],
    ];
    foreach ($cases as $case) {
        $field = array_pop($case);
        $this->postJson(QUOTE_URL, quotePayload($case))->assertUnprocessable()->assertJsonValidationErrors([$field]);
    }

    expect(QuoteRequest::count())->toBe(0);
});

it('accepte une date future, un quartier de la ville et un budget', function () {
    $district = District::factory()->create();

    $this->postJson(QUOTE_URL, quotePayload([
        'city_id' => $district->city_id, 'district_id' => $district->id,
        'desired_start_date' => now()->addWeek()->format('Y-m-d'), 'budget_range' => '1 000 000 FCFA',
    ]))->assertCreated();

    $quote = QuoteRequest::query()->firstOrFail();
    expect($quote->district_id)->toBe($district->id)
        ->and($quote->desired_start_date?->format('Y-m-d'))->toBe(now()->addWeek()->format('Y-m-d'));
});

it('champ piège rempli : 201 identique mais rien d\'enregistré ni d\'envoyé', function () {
    makeAdmin();

    $res = $this->postJson(QUOTE_URL, quotePayload(['company_website' => 'http://spam.example']))->assertCreated();

    expect($res->json('data.reference'))->toMatch('/^DEV-\d{4}-\d{6}$/')
        ->and($res->json('data.message'))->toBeString()
        ->and(array_keys($res->json('data')))->toBe(['reference', 'message']);
    expect(QuoteRequest::count())->toBe(0)
        ->and(ConsentLog::count())->toBe(0)
        ->and(IdempotencyKey::count())->toBe(0);
    Notification::assertNothingSent();
});

it('Idempotency-Key : deux envois identiques = un devis, un accusé', function () {
    $payload = quotePayload();
    $headers = ['Idempotency-Key' => 'cle-devis-0001'];

    $a = $this->postJson(QUOTE_URL, $payload, $headers)->assertCreated();
    $b = $this->postJson(QUOTE_URL, $payload, $headers)->assertCreated();

    expect($b->json('data.reference'))->toBe($a->json('data.reference'))
        ->and(QuoteRequest::count())->toBe(1)
        ->and(ConsentLog::where('purpose', 'quote')->count())->toBe(1);
    Notification::assertSentOnDemandTimes(QuoteMail::class, 1);

    $this->postJson(QUOTE_URL, $payload + ['budget_range' => 'autre'], $headers)
        ->assertUnprocessable()->assertJsonValidationErrors(['idempotency_key']);
    expect(QuoteRequest::count())->toBe(1);
});

it('limite à 5 devis par heure et par IP (429 + Retry-After) sans compter les erreurs de validation', function () {
    config(['public_forms.limits.quote.ip_per_hour' => 2]);

    $this->postJson(QUOTE_URL, quotePayload(['email' => 'a@example.com']))->assertCreated();
    $this->postJson(QUOTE_URL, quotePayload(['email' => 'invalide']))->assertUnprocessable();
    $this->postJson(QUOTE_URL, quotePayload(['email' => 'b@example.com']))->assertCreated();

    $res = $this->postJson(QUOTE_URL, quotePayload(['email' => 'c@example.com']))->assertStatus(429);
    expect((int) $res->headers->get('Retry-After'))->toBeGreaterThan(0);
    expect(QuoteRequest::count())->toBe(2);
});

it('limite à 10 devis par jour et par e-mail (429)', function () {
    config(['public_forms.limits.quote.ip_per_hour' => 100, 'public_forms.limits.quote.email_per_day' => 2]);

    $this->postJson(QUOTE_URL, quotePayload())->assertCreated();
    $this->postJson(QUOTE_URL, quotePayload())->assertCreated();
    $this->postJson(QUOTE_URL, quotePayload())->assertStatus(429)->assertHeader('Retry-After');
    $this->postJson(QUOTE_URL, quotePayload(['email' => 'autre@example.com']))->assertCreated();
});

it('exige et vérifie le jeton Turnstile quand il est activé', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'secret-de-test']);
    Http::fake(['https://challenges.cloudflare.com/*' => Http::sequence()->push(['success' => false])->push(['success' => true])]);

    $this->postJson(QUOTE_URL, quotePayload())->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson(QUOTE_URL, quotePayload(['turnstile_token' => 'mauvais']))->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson(QUOTE_URL, quotePayload(['turnstile_token' => 'bon']))->assertCreated();
    expect(QuoteRequest::count())->toBe(1);
});

it('ne renvoie aucune coordonnée du demandeur dans la réponse publique', function () {
    $body = $this->postJson(QUOTE_URL, quotePayload())->assertCreated()->getContent();

    expect($body)->not->toContain('awa.traore@example.com')->not->toContain('2250709445111')->not->toContain('Traoré');
});
