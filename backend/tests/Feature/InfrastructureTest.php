<?php

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
