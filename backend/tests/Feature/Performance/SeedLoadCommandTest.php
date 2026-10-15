<?php

use App\Models\Provider;
use Database\Seeders\ReferenceSeeder;
use Illuminate\Support\Facades\DB;

it('refuse de tourner en production', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->artisan('app:seed-load', ['--providers' => 5, '--force' => true])->assertFailed();

    expect(Provider::count())->toBe(0);
});

it('refuse une base dont le nom ne contient pas « perf » sans --force', function () {
    expect(DB::connection()->getDatabaseName())->not->toContain('perf');

    $this->artisan('app:seed-load', ['--providers' => 5])->assertFailed();

    expect(Provider::count())->toBe(0);
});

it('génère un jeu de charge cohérent avec --force et n\'est jamais appelé par DemoSeeder', function () {
    $this->seed(ReferenceSeeder::class);

    $this->artisan('app:seed-load', ['--providers' => 40, '--state-forces' => 6, '--posts' => 12, '--reviews' => 30, '--force' => true])->assertSuccessful();

    expect(Provider::count())->toBe(40)
        ->and(DB::table('state_forces')->count())->toBe(6)
        ->and(DB::table('posts')->count())->toBe(12)
        ->and(DB::table('reviews')->count())->toBeGreaterThan(0)
        ->and(DB::table('provider_service_type')->count())->toBeGreaterThan(0);

    // Les fiches de charge respectent le filtre public : 1 sur 20 est en attente.
    expect(Provider::query()->published()->count())->toBe(38);

    expect(file_get_contents(base_path('database/seeders/DemoSeeder.php')))->not->toContain('SeedLoad')->not->toContain('seed-load');
});
