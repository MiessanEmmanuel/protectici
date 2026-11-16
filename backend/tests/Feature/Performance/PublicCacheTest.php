<?php

use App\Models\City;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\Review;
use App\Models\ServiceType;
use App\Models\User;
use App\Support\PublicCache;
use Illuminate\Support\Facades\DB;

/** Nombre de requêtes SQL émises par un appel (l'ensemble de l'application, limiteurs inclus). */
function queriesFor(callable $call): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $call();
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $count;
}

it('sert la deuxième lecture de la liste depuis le cache avec des en-têtes publics et un ETag', function () {
    makeProvider(['name' => 'Alpha'], City::factory()->create());

    $first = $this->getJson('/api/v1/providers')->assertOk();
    $queries = queriesFor(fn () => $this->getJson('/api/v1/providers')->assertOk());
    $second = $this->getJson('/api/v1/providers')->assertOk();

    expect($second->getContent())->toBe($first->getContent())
        ->and($queries)->toBe(0)
        ->and($second->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=60')
        ->and($second->headers->get('ETag'))->toBe($first->headers->get('ETag'))->not->toBeEmpty()
        ->and($second->headers->get('Vary'))->toContain('Cookie');
});

it('répond 304 sans corps quand l\'ETag est inchangé', function () {
    makeProvider(['name' => 'Alpha'], City::factory()->create());
    $etag = $this->getJson('/api/v1/providers')->headers->get('ETag');

    $response = $this->getJson('/api/v1/providers', ['If-None-Match' => $etag]);

    $response->assertStatus(304);
    expect($response->getContent())->toBe('')->and($response->headers->get('ETag'))->toBe($etag);
});

it('invalide la liste et la fiche à l\'écriture d\'une fiche', function () {
    $city = City::factory()->create();
    $a = makeProvider(['name' => 'Alpha'], $city);
    expect($this->getJson('/api/v1/providers')->json('meta.total'))->toBe(1)
        ->and($this->getJson('/api/v1/providers/'.$a->slug)->json('data.name'))->toBe('Alpha');

    makeProvider(['name' => 'Beta'], $city);
    $a->update(['name' => 'Alpha Renommée']);

    expect($this->getJson('/api/v1/providers')->json('meta.total'))->toBe(2)
        ->and($this->getJson('/api/v1/providers/'.$a->slug)->json('data.name'))->toBe('Alpha Renommée');

    $a->delete();
    $this->getJson('/api/v1/providers/'.$a->slug)->assertNotFound();
    expect($this->getJson('/api/v1/providers')->json('meta.total'))->toBe(1);
});

it('invalide les avis et la note moyenne à la publication d\'un avis', function () {
    $p = makeProvider(['name' => 'Alpha'], City::factory()->create());
    expect($this->getJson('/api/v1/providers/'.$p->slug.'/reviews')->json('meta.total'))->toBe(0);

    Review::factory()->create(['provider_id' => $p->id, 'rating' => 4]);

    expect($this->getJson('/api/v1/providers/'.$p->slug.'/reviews')->json('meta.total'))->toBe(1)
        ->and($this->getJson('/api/v1/providers/'.$p->slug)->json('data.rating_count'))->toBe(1);
});

it('ne met jamais en cache une requête authentifiée et ne la sert pas depuis le cache', function () {
    $p = makeProvider(['name' => 'Alpha'], City::factory()->create());
    $user = User::factory()->create();
    $user->favoriteProviders()->attach($p->id);

    // Anonyme d'abord : l'entrée anonyme existe (is_favorite = null).
    expect($this->getJson('/api/v1/providers/'.$p->slug)->json('data.is_favorite'))->toBeNull();

    // Connecté : jamais la version anonyme, jamais de cache public.
    $auth = $this->actingAs($user)->getJson('/api/v1/providers/'.$p->slug)->assertOk();
    expect($auth->json('data.is_favorite'))->toBeTrue()
        ->and($auth->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($auth->headers->get('Cache-Control'))->not->toContain('public')
        ->and($auth->headers->has('ETag'))->toBeFalse();

    // Retour à l'anonyme : toujours la version anonyme (aucune fuite de la réponse connectée).
    $this->app['auth']->forgetGuards();
    expect($this->getJson('/api/v1/providers/'.$p->slug)->json('data.is_favorite'))->toBeNull();
});

it('ne stocke pas une réponse construite pour un utilisateur connecté', function () {
    $p = makeProvider(['name' => 'Alpha'], City::factory()->create());
    $user = User::factory()->create();
    $user->favoriteProviders()->attach($p->id);

    // Connecté en premier : rien ne doit être écrit dans le cache.
    expect($this->actingAs($user)->getJson('/api/v1/providers/'.$p->slug)->json('data.is_favorite'))->toBeTrue();
    $this->app['auth']->forgetGuards();

    expect($this->getJson('/api/v1/providers/'.$p->slug)->json('data.is_favorite'))->toBeNull();
});

it('ignore le cache dès qu\'un en-tête Authorization est présent', function () {
    $p = makeProvider(['name' => 'Alpha'], City::factory()->create());
    $this->getJson('/api/v1/providers/'.$p->slug)->assertOk();

    $response = $this->getJson('/api/v1/providers/'.$p->slug, ['Authorization' => 'Bearer invalide']);

    expect($response->headers->get('Cache-Control'))->not->toContain('public');
});

it('ne met pas en cache les erreurs (404, 422)', function () {
    $this->getJson('/api/v1/providers/inconnu')->assertNotFound();
    $this->getJson('/api/v1/providers?per_page=0')->assertUnprocessable();

    $r = $this->getJson('/api/v1/providers?per_page=0');
    expect($r->headers->get('Cache-Control'))->not->toContain('public');
});

it('distingue les requêtes par paramètres (ordre indifférent) et par page', function () {
    $city = City::factory()->create();
    foreach (range(1, 3) as $i) {
        makeProvider(['name' => "Societe {$i}"], $city);
    }

    $p1 = $this->getJson('/api/v1/providers?per_page=2&page=1');
    $p2 = $this->getJson('/api/v1/providers?per_page=2&page=2');
    $p1bis = $this->getJson('/api/v1/providers?page=1&per_page=2');

    expect($p1->json('data'))->toHaveCount(2)->and($p2->json('data'))->toHaveCount(1)
        ->and($p1bis->getContent())->toBe($p1->getContent());
    expect(queriesFor(fn () => $this->getJson('/api/v1/providers?page=1&per_page=2')))->toBe(0);
});

it('garde un nombre de requêtes SQL borné quelle que soit la taille de la page', function () {
    $city = City::factory()->create();
    $small = (function () use ($city) {
        makeProvider(['name' => 'A'], $city);

        return queriesFor(fn () => $this->getJson('/api/v1/providers?per_page=50')->assertOk());
    })();

    foreach (range(1, 30) as $i) {
        $p = makeProvider(['name' => "Societe {$i}"], $city);
        $p->serviceTypes()->attach(ServiceType::factory()->create());
    }
    $large = queriesFor(fn () => $this->getJson('/api/v1/providers?per_page=50&page=1&x=1')->assertOk());

    expect($large)->toBeLessThanOrEqual($small + 2)->and($large)->toBeLessThanOrEqual(12);
});

it('invalide le blog à la publication d\'un article, sans cacher le compteur de vues', function () {
    $category = PostCategory::factory()->create(['is_visible' => true]);
    $post = Post::factory()->create(['category_id' => $category->id, 'title' => 'Premier']);
    expect($this->getJson('/api/v1/blog/posts')->json('meta.total'))->toBe(1);

    Post::factory()->create(['category_id' => $category->id, 'title' => 'Second']);
    expect($this->getJson('/api/v1/blog/posts')->json('meta.total'))->toBe(2);

    // Le détail d'un article n'est jamais servi depuis le cache : chaque lecture compte (une par IP / 30 min).
    $show = $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertOk();
    expect($show->headers->has('ETag'))->toBeFalse()
        ->and($show->headers->get('Cache-Control'))->not->toContain('public');
});

it('peut être désactivé par configuration', function () {
    config(['cache.public.enabled' => false]);
    makeProvider(['name' => 'Alpha'], City::factory()->create());

    $this->getJson('/api/v1/providers')->assertOk();
    $r = $this->getJson('/api/v1/providers')->assertOk();

    expect($r->headers->has('ETag'))->toBeFalse();
});

it('renouvelle le jeton de version de l\'espace à chaque écriture', function () {
    $before = PublicCache::token(PublicCache::DIRECTORY);
    expect(PublicCache::token(PublicCache::DIRECTORY))->toBe($before);

    makeProvider(['name' => 'Alpha'], City::factory()->create());

    expect(PublicCache::token(PublicCache::DIRECTORY))->not->toBe($before);
});

it('crée les index de performance de l\'annuaire', function () {
    $names = DB::table('pg_indexes')->where('schemaname', 'public')->pluck('indexname')->all();

    expect($names)->toContain('providers_public_name_idx', 'providers_public_popular_idx', 'providers_public_rating_idx', 'state_forces_public_name_idx');
});

it('utilise l\'index de tri par nom pour la première page de l\'annuaire', function () {
    // Désactive les chemins sans index ordonné : le test porte sur la disponibilité de l'index, pas sur les statistiques.
    foreach (['enable_seqscan', 'enable_sort', 'enable_bitmapscan'] as $setting) {
        DB::statement("SET LOCAL {$setting} = off");
    }
    $plan = collect(DB::select("EXPLAIN select * from providers where is_visible and status = 'approved' and deleted_at is null order by name, id limit 12"))
        ->pluck('QUERY PLAN')->implode("\n");

    expect($plan)->toContain('providers_public_name_idx');
});

it('ne met pas en cache une requête à la chaîne de paramètres démesurée', function () {
    makeProvider(['name' => 'Alpha'], City::factory()->create());
    $long = '/api/v1/providers?junk='.str_repeat('a', 500);

    $this->getJson($long)->assertOk();
    $r = $this->getJson($long)->assertOk();

    expect($r->headers->has('ETag'))->toBeFalse();
});

it('purge les entrées de cache expirées en base', function () {
    config(['cache.default' => 'database']);
    DB::table('cache')->insert([
        ['key' => 'expire-1', 'value' => 's:1:"a";', 'expiration' => time() - 10],
        ['key' => 'vivant-1', 'value' => 's:1:"a";', 'expiration' => time() + 600],
    ]);

    $this->artisan('cache:purge-expired')->assertSuccessful();

    expect(DB::table('cache')->where('key', 'expire-1')->exists())->toBeFalse()
        ->and(DB::table('cache')->where('key', 'vivant-1')->exists())->toBeTrue();
});

it('ne sert jamais une réponse « public » portant un cookie (origine stateful : private)', function () {
    makeProvider(['name' => 'Alpha'], City::factory()->create());

    $anonymous = $this->getJson('/api/v1/providers')->assertOk();
    expect($anonymous->headers->getCookies())->toBe([])
        ->and($anonymous->headers->get('Cache-Control'))->toContain('public');

    $stateful = $this->withHeaders($this->spaHeaders())->getJson('/api/v1/providers')->assertOk();
    expect($stateful->headers->getCookies())->not->toBe([])
        ->and($stateful->headers->get('Cache-Control'))->not->toContain('public')->toContain('private')->toContain('max-age=60');
});
