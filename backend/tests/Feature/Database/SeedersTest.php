<?php

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\FeedbackTopic;
use App\Models\Page;
use App\Models\PostCategory;
use App\Models\Provider;
use App\Models\Review;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Database\Seeders\ReferenceSeeder;

it('ReferenceSeeder est idempotent et complet', function () {
    $this->seed(ReferenceSeeder::class);
    $this->seed(ReferenceSeeder::class);

    expect(City::where('slug', 'abidjan')->exists())->toBeTrue();
    expect(ServiceType::count())->toBe(24);
    expect(CompanyType::count())->toBe(6);
    expect(PostCategory::count())->toBe(7);
    expect(FeedbackTopic::count())->toBe(8);
    expect(District::count())->toBeGreaterThan(30);
    expect(Page::where('is_visible', true)->count())->toBe(0);
    expect(ServiceType::pluck('name')->implode(' '))->not->toContain('Swipping')->not->toContain('Alarm/');
});

it('DemoSeeder génère des données factices cohérentes', function () {
    $this->seed(DemoSeeder::class);

    expect(Provider::whereIn('name', ['Dauphin Sécurité', 'Fenapepsci', 'Global Security Challenge', 'Puissance 6 Security', 'Royal Force'])->count())->toBe(5);
    expect(Provider::count())->toBeGreaterThanOrEqual(40);
    expect(StateForce::count())->toBeGreaterThanOrEqual(30);
    expect(Review::count())->toBeGreaterThan(50);
    foreach (['admin', 'editor', 'provider', 'user'] as $role) {
        expect(User::where('role', $role)->exists())->toBeTrue();
    }
    expect(Provider::where('rccm', 'not like', 'CI-ABJ-DEMO-%')->count())->toBe(0);
    expect(Provider::where('is_visible', true)->where('status', '!=', 'approved')->count())->toBe(0);
    expect(Provider::where('rating_count', '>', 0)->exists())->toBeTrue();
});

it('DemoSeeder refuse de s\'exécuter en production', function () {
    $this->app['env'] = 'production';

    expect(fn () => (new DemoSeeder)->run())->toThrow(RuntimeException::class, 'interdit en production');
    expect(User::count())->toBe(0);
});
