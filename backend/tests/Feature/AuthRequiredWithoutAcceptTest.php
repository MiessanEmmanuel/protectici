<?php

it('répond 401 JSON sur une route protégée même sans en-tête Accept', function () {
    $this->get('/api/v1/admin/reviews', ['Accept' => 'text/html'])
        ->assertStatus(401)
        ->assertJson(['message' => 'Authentification requise.']);
});
