<?php

use App\Services\Turnstile\CloudflareTurnstileVerifier;
use App\Services\Turnstile\NullTurnstileVerifier;
use App\Services\Turnstile\TurnstileVerifier;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

beforeEach(function () {
    Http::preventStrayRequests();
    Notification::fake();
    $this->withHeaders($this->spaHeaders());
});

function enableTurnstile(): void
{
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'secret-de-test']);
}

function registerPayload(array $extra = []): array
{
    return array_merge([
        'first_name' => 'Aya', 'last_name' => 'Koffi', 'email' => 'aya@example.com',
        'password' => 'Abidjan-2026', 'password_confirmation' => 'Abidjan-2026', 'consent' => true,
    ], $extra);
}

it('est désactivé en test (aucun appel réseau)', function () {
    expect(app(TurnstileVerifier::class))->toBeInstanceOf(NullTurnstileVerifier::class);

    $this->postJson('/api/v1/auth/register', registerPayload())->assertStatus(202);
    Http::assertNothingSent();
});

it('vérifie le jeton auprès de Cloudflare côté serveur', function () {
    Http::fake([TURNSTILE_URL => Http::response(['success' => true])]);
    $verifier = new CloudflareTurnstileVerifier('secret-de-test', TURNSTILE_URL);

    expect($verifier->verify('jeton-client', '203.0.113.5'))->toBeTrue();

    Http::assertSent(fn (HttpRequest $r) => $r->url() === TURNSTILE_URL
        && $r['secret'] === 'secret-de-test'
        && $r['response'] === 'jeton-client'
        && $r['remoteip'] === '203.0.113.5');
});

it('échoue (fail closed) si Cloudflare refuse ou est injoignable', function () {
    Http::fake([TURNSTILE_URL => Http::sequence()
        ->push(['success' => false, 'error-codes' => ['invalid-input-response']])
        ->push('erreur', 500)
        ->whenEmpty(fn () => throw new ConnectionException('timeout'))]);
    $verifier = new CloudflareTurnstileVerifier('secret-de-test', TURNSTILE_URL);

    expect($verifier->verify('a'))->toBeFalse()
        ->and($verifier->verify('b'))->toBeFalse()
        ->and($verifier->verify('c'))->toBeFalse()
        ->and((new CloudflareTurnstileVerifier('', TURNSTILE_URL))->verify('d'))->toBeFalse();
});

it('exige et vérifie le jeton à l\'inscription quand il est activé', function () {
    enableTurnstile();
    Http::fake([TURNSTILE_URL => Http::sequence()->push(['success' => false])->push(['success' => true])]);

    $this->postJson('/api/v1/auth/register', registerPayload())
        ->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson('/api/v1/auth/register', registerPayload(['turnstile_token' => 'mauvais']))
        ->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson('/api/v1/auth/register', registerPayload(['turnstile_token' => 'bon']))
        ->assertStatus(202);
});

it('exige le jeton au mot de passe oublié quand il est activé', function () {
    enableTurnstile();
    config(['auth.forgot_password_timebox_ms' => 0]);
    Http::fake([TURNSTILE_URL => Http::response(['success' => true])]);

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'x@example.com'])
        ->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'x@example.com', 'turnstile_token' => 'ok'])
        ->assertOk();
});
