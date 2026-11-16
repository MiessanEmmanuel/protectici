<?php

use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\URL;

it('renvoie une 404 JSON générique sans trace', function () {
    $response = $this->getJson('/api/v1/inexistant');

    $response->assertNotFound()->assertExactJson(['message' => 'Ressource introuvable.']);
});

it('renvoie les en-têtes de sécurité', function () {
    $response = $this->getJson('/api/v1/inexistant');

    $response->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect($response->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'");
    expect($response->headers->has('X-Powered-By'))->toBeFalse();
});

it('refuse une origine CORS non listée et accepte le front', function () {
    $ok = $this->withHeaders(['Origin' => 'http://localhost:3000'])->options('/api/v1/inexistant', [], ['Access-Control-Request-Method' => 'GET']);
    expect($ok->headers->get('Access-Control-Allow-Origin'))->toBe('http://localhost:3000');
    expect($ok->headers->get('Access-Control-Allow-Credentials'))->toBe('true');

    $ko = $this->withHeaders(['Origin' => 'https://evil.example', 'Access-Control-Request-Method' => 'GET'])->options('/api/v1/inexistant');
    expect($ko->headers->get('Access-Control-Allow-Origin'))->not->toBe('*')->not->toBe('https://evil.example');
});

it('rend le cookie de session Secure par défaut en production même sans variable SESSION_SECURE_COOKIE', function () {
    $saved = [$_ENV['SESSION_SECURE_COOKIE'] ?? null, $_SERVER['SESSION_SECURE_COOKIE'] ?? null, $_ENV['APP_ENV'] ?? null, $_SERVER['APP_ENV'] ?? null];
    unset($_ENV['SESSION_SECURE_COOKIE'], $_SERVER['SESSION_SECURE_COOKIE']);
    putenv('SESSION_SECURE_COOKIE');
    $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'production';

    try {
        $config = require config_path('session.php');
        expect($config['secure'])->toBeTrue()
            ->and($config['http_only'])->toBeTrue()
            ->and($config['same_site'])->toBe('lax');
    } finally {
        [$a, $b, $c, $d] = $saved;
        $_ENV['APP_ENV'] = $c;
        $_SERVER['APP_ENV'] = $d;
        if ($a !== null) {
            $_ENV['SESSION_SECURE_COOKIE'] = $a;
        }
        if ($b !== null) {
            $_SERVER['SESSION_SECURE_COOKIE'] = $b;
        }
    }
});

it('ancre les URL générées sur APP_URL en production (injection d\'en-tête Host)', function () {
    config(['app.url' => 'https://api.exemple.test']);
    app()['env'] = 'production';

    try {
        AppServiceProvider::pinRootUrl();
        $url = URL::temporarySignedRoute('auth.verification.verify', now()->addMinutes(5), ['id' => 1, 'hash' => 'x']);

        expect($url)->toStartWith('https://api.exemple.test/');
    } finally {
        app()['env'] = 'testing';
        URL::forceRootUrl(null);
    }
});

it('rejette un corps JSON malformé (400 uniforme) au lieu de le traiter comme vide', function () {
    $user = User::factory()->create(['first_name' => 'Awa']);

    $response = $this->actingAs($user)->call('PATCH', '/api/v1/auth/profile', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
    ], '{"first_name": "Koffi",');

    $response->assertStatus(400)
        ->assertExactJson(['message' => 'Le corps de la requête n\'est pas un JSON valide.', 'code' => 'malformed_json'])
        ->assertHeader('X-Content-Type-Options', 'nosniff');
    expect($user->fresh()->first_name)->toBe('Awa');

    // Corps vide ou JSON valide : traitement normal.
    $this->actingAs($user)->call('PATCH', '/api/v1/auth/profile', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], '')
        ->assertOk();
    $this->actingAs($user)->patchJson('/api/v1/auth/profile', ['first_name' => 'Koffi'])->assertOk();
    expect($user->fresh()->first_name)->toBe('Koffi');
});
