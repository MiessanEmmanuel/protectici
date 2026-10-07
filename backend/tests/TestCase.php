<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Garde-fou : ne jamais exécuter (ni vider) autre chose qu'une base de test PostgreSQL.
        $connection = config('database.default');
        $database = (string) config("database.connections.{$connection}.database");

        if ($connection !== 'pgsql' || ! str_contains($database, '_test')) {
            throw new RuntimeException("Les tests doivent utiliser PostgreSQL sur une base *_test (actuel : {$connection}/{$database}).");
        }
    }

    /** En-têtes d'une requête provenant du front Next.js (origine « stateful » Sanctum). */
    protected function spaHeaders(): array
    {
        return [
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/',
            'Accept' => 'application/json',
        ];
    }
}
