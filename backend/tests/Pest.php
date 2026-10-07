<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

require_once __DIR__.'/Helpers.php';

/*
| Tous les tests tournent sur PostgreSQL + PostGIS (protectici_test), jamais SQLite.
| Pour isoler une exécution parallèle : DB_DATABASE=protectici_test_b php artisan test
| Aucun appel réseau réel : toute requête HTTP sortante non simulée échoue.
*/
pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(fn () => Http::preventStrayRequests())
    ->in('Feature', 'Unit');
