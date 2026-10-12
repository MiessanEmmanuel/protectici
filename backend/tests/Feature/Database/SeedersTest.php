<?php

use App\Models\City;
use App\Models\CompanyType;
use App\Models\District;
use App\Models\FeedbackTopic;
use App\Models\NewsletterSubscriber;
use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\PostComment;
use App\Models\Provider;
use App\Models\Review;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Models\User;
use Database\Seeders\ContentSeeder;
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

it('ContentSeeder produit un contenu éditorial français, cohérent et idempotent', function () {
    $this->seed(DemoSeeder::class);
    $this->seed(ContentSeeder::class); // second passage : idempotent

    expect(PostCategory::count())->toBe(7);
    expect(Post::count())->toBeGreaterThanOrEqual(18);
    foreach (['published', 'draft', 'scheduled', 'archived'] as $status) {
        expect(Post::where('status', $status)->exists())->toBeTrue();
    }
    expect(Post::where('is_featured', true)->exists())->toBeTrue();
    expect(Post::where('is_flash', true)->where('is_visible', true)->exists())->toBeTrue();
    expect(Post::where('status', 'scheduled')->where('published_at', '<=', now())->count())->toBe(0);
    expect(PostComment::where('status', 'pending')->exists())->toBeTrue();
    expect(PostComment::where('status', 'approved')->where('is_visible', true)->exists())->toBeTrue();
    expect(Page::whereIn('slug', ['qui-sommes-nous', 'mentions-legales', 'confidentialite', 'cgu'])->where('is_visible', true)->count())->toBe(4);
    expect(Partner::where('type', 'partner')->exists())->toBeTrue();
    expect(Partner::where('type', 'client')->exists())->toBeTrue();
    expect(NewsletterSubscriber::where('email', 'not like', '%.test')->count())->toBe(0);
    expect(NewsletterSubscriber::where('status', 'confirmed')->exists())->toBeTrue();

    $text = Post::pluck('body')->merge(Post::pluck('title'))->merge(Page::pluck('body'))->implode(' ');
    expect(mb_strtolower($text))->not->toContain('lorem')->not->toContain('ipsum')->not->toContain('the ')->not->toContain('demo article');
});
