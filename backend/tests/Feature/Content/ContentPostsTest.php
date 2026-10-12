<?php

use App\Models\AuditLog;
use App\Models\Media;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const CP = '/api/v1/content';

function validPost(array $overrides = []): array
{
    return array_merge([
        'title' => 'Sécuriser un entrepôt en cinq étapes',
        'category_id' => PostCategory::factory()->create()->id,
        'body' => '<p>Premier paragraphe du guide.</p>',
        'status' => 'draft',
    ], $overrides);
}

// --- Autorisations -------------------------------------------------------------------------------------------------

it('exige une session (401) pour tout /content/*', function (string $method, string $path) {
    $this->json($method, CP.$path)->assertUnauthorized();
})->with([
    ['GET', '/posts'], ['POST', '/posts'], ['GET', '/posts/1'], ['PATCH', '/posts/1'], ['DELETE', '/posts/1'], ['POST', '/media'],
    ['GET', '/comments'], ['PATCH', '/comments/1'], ['GET', '/pages'], ['GET', '/pages/cgu'], ['PUT', '/pages/cgu'],
    ['GET', '/partners'], ['POST', '/partners'], ['PATCH', '/partners/1'], ['DELETE', '/partners/1'], ['GET', '/categories'], ['PATCH', '/categories/1'],
]);

it('interdit /content/* à un compte utilisateur ou prestataire (403)', function (string $method, string $path) {
    foreach ([User::factory()->create(), User::factory()->provider()->create()] as $user) {
        $this->actingAs($user)->json($method, CP.$path)->assertForbidden();
    }
})->with([
    ['GET', '/posts'], ['POST', '/posts'], ['GET', '/posts/1'], ['PATCH', '/posts/1'], ['DELETE', '/posts/1'], ['POST', '/media'],
    ['GET', '/comments'], ['PATCH', '/comments/1'], ['GET', '/pages'], ['GET', '/pages/cgu'], ['PUT', '/pages/cgu'],
    ['GET', '/partners'], ['POST', '/partners'], ['PATCH', '/partners/1'], ['DELETE', '/partners/1'], ['GET', '/categories'], ['PATCH', '/categories/1'],
]);

it('exige la 2FA pour le personnel éditorial', function () {
    $editor = User::factory()->editor()->create();

    $this->actingAs($editor)->getJson(CP.'/posts')->assertForbidden();
});

it('refuse à un éditeur toute la zone /admin et les données de l\'annuaire et du personnel (403)', function (string $method, string $path) {
    $this->actingAs(makeEditor())->json($method, '/api/v1/admin'.$path)->assertForbidden();
})->with([
    ['GET', '/dashboard'], ['GET', '/users'], ['GET', '/users/1'], ['PATCH', '/users/1'], ['GET', '/establishments'],
    ['GET', '/establishments/provider/1'], ['POST', '/establishments/provider/1/approve'], ['GET', '/change-requests'],
    ['GET', '/audit-logs'], ['GET', '/reviews'], ['GET', '/feedbacks'], ['GET', '/quote-requests'], ['GET', '/contact-messages'],
    ['GET', '/settings'], ['PUT', '/settings'], ['GET', '/newsletter/subscribers'], ['GET', '/reference/post-categories'],
]);

it('ne montre à un éditeur aucune donnée de prestataire : ses espaces « /me » ne contiennent que les siens (vides)', function () {
    $owner = User::factory()->provider()->create();
    pendingProviderOf($owner);
    $editor = makeEditor();

    expect($this->actingAs($editor)->getJson('/api/v1/me/quote-requests')->status())->toBeIn([200, 403, 404]);
    $mine = $this->actingAs($editor)->getJson('/api/v1/me/establishments');
    expect($mine->status())->toBeIn([200, 403, 404]);
    if ($mine->status() === 200) {
        expect(json_encode($mine->json()))->not->toContain('Sentinelle');
        expect($mine->json('data'))->toBeEmpty();
    }
    // Fiche d'autrui : jamais accessible.
    $this->actingAs($editor)->getJson('/api/v1/admin/establishments/provider/1')->assertForbidden();
});

// --- Articles -----------------------------------------------------------------------------------------------------

it('crée un article en brouillon : slug unique, durée de lecture, audit', function () {
    $editor = makeEditor();

    $response = $this->actingAs($editor)->postJson(CP.'/posts', validPost())->assertCreated();

    $post = Post::firstOrFail();
    expect($post->slug)->toBe('securiser-un-entrepot-en-cinq-etapes')->and($post->status)->toBe('draft')
        ->and($post->is_visible)->toBeFalse()->and($post->author_id)->toBe($editor->id)->and($post->reading_minutes)->toBe(1)
        ->and($post->excerpt)->toBe('Premier paragraphe du guide.')->and($post->views_count)->toBe(0);
    expect($response->json('data.id'))->toBe($post->id)->and($response->json('data.body'))->toBe('<p>Premier paragraphe du guide.</p>');
    expect(AuditLog::where('event', 'post_created')->where('user_id', $editor->id)->count())->toBe(1);
    $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertNotFound();
});

it('génère un slug distinct pour deux titres identiques', function () {
    $editor = makeEditor();
    $this->actingAs($editor)->postJson(CP.'/posts', validPost())->assertCreated();
    $this->actingAs($editor)->postJson(CP.'/posts', validPost())->assertCreated();

    expect(Post::orderBy('id')->pluck('slug')->all())->toBe(['securiser-un-entrepot-en-cinq-etapes', 'securiser-un-entrepot-en-cinq-etapes-2']);
});

it('nettoie le HTML de l\'article avant enregistrement', function () {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', validPost([
        'body' => '<p onclick="x()">Texte <script>alert(1)</script><a href="javascript:alert(1)">piège</a></p><iframe src="https://evil.test"></iframe><img src="https://evil.test/a.png">',
    ]))->assertCreated();

    expect(Post::firstOrFail()->body)->toBe('<p>Texte piège</p>');
});

it('refuse un article sans texte exploitable', function () {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', validPost(['body' => '<script>alert(1)</script>']))
        ->assertStatus(422)->assertJsonValidationErrors(['body']);
    expect(Post::count())->toBe(0);
});

it('publie immédiatement un article « published » et le rend visible au public', function () {
    $this->actingAs(makeAdmin())->postJson(CP.'/posts', validPost(['status' => 'published', 'is_flash' => true, 'is_featured' => true]))->assertCreated();

    $post = Post::firstOrFail();
    expect($post->status)->toBe('published')->and($post->is_visible)->toBeTrue()->and($post->published_at)->not->toBeNull();
    $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertOk();
    $this->getJson('/api/v1/blog/flash')->assertJsonCount(1, 'data');
});

it('planifie un article, le publie par la commande, et ignore les dates futures', function () {
    $editor = makeEditor();
    $this->actingAs($editor)->postJson(CP.'/posts', validPost(['status' => 'scheduled']))->assertStatus(422)->assertJsonValidationErrors(['published_at']);

    $this->actingAs($editor)->postJson(CP.'/posts', validPost(['status' => 'scheduled', 'published_at' => now()->addHour()->toIso8601String()]))->assertCreated();
    $post = Post::firstOrFail();
    expect($post->status)->toBe('scheduled')->and($post->is_visible)->toBeFalse();

    $this->artisan('posts:publish-scheduled')->assertSuccessful();
    expect($post->refresh()->status)->toBe('scheduled');
    $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertNotFound();

    $this->travel(61)->minutes();
    $this->artisan('posts:publish-scheduled')->assertSuccessful();
    expect($post->refresh()->status)->toBe('published')->and($post->is_visible)->toBeTrue();
    $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertOk();
    expect(AuditLog::where('event', 'post_published_scheduled')->count())->toBe(1);

    $this->artisan('posts:publish-scheduled')->assertSuccessful(); // idempotent
    expect(AuditLog::where('event', 'post_published_scheduled')->count())->toBe(1);
});

it('transforme une publication à date future en article planifié', function () {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', validPost(['status' => 'published', 'published_at' => now()->addDays(2)->toIso8601String()]))->assertCreated();

    expect(Post::firstOrFail()->status)->toBe('scheduled');
});

it('valide la création d\'un article', function (array $payload, string $field) {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', $payload + validPost())->assertStatus(422)->assertJsonValidationErrors([$field]);
})->with([
    'titre vide' => [['title' => ''], 'title'],
    'titre trop long' => [['title' => str_repeat('a', 201)], 'title'],
    'catégorie inconnue' => [['category_id' => 999999], 'category_id'],
    'statut inconnu' => [['status' => 'public'], 'status'],
    'résumé trop long' => [['excerpt' => str_repeat('a', 501)], 'excerpt'],
    'date invalide' => [['published_at' => 'demain'], 'published_at'],
    'titre SEO trop long' => [['seo_title' => str_repeat('a', 161)], 'seo_title'],
    'drapeau invalide' => [['is_flash' => 'peut-être'], 'is_flash'],
]);

it('exige titre, catégorie et contenu à la création', function () {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', [])->assertStatus(422)->assertJsonValidationErrors(['title', 'category_id', 'body']);
});

it('ignore les champs protégés (mass-assignment) : auteur, slug, vues, visibilité', function () {
    $editor = makeEditor();
    $other = User::factory()->admin()->create();

    $this->actingAs($editor)->postJson(CP.'/posts', validPost(['author_id' => $other->id, 'slug' => 'pirate', 'views_count' => 9999, 'is_visible' => true, 'id' => 77]))->assertCreated();

    $post = Post::firstOrFail();
    expect($post->author_id)->toBe($editor->id)->and($post->slug)->not->toBe('pirate')->and($post->views_count)->toBe(0)
        ->and($post->is_visible)->toBeFalse()->and($post->id)->not->toBe(77);
});

it('liste tous les statuts, filtre et recherche, sans exposer d\'e-mail', function () {
    $category = PostCategory::factory()->create(['slug' => 'formation']);
    Post::factory()->create(['category_id' => $category->id, 'title' => 'Formation incendie']);
    Post::factory()->draft()->create(['category_id' => $category->id, 'title' => 'Brouillon secourisme']);
    Post::factory()->create(['title' => 'Autre sujet', 'status' => 'archived', 'is_visible' => false, 'category_id' => PostCategory::factory()]);
    $editor = makeEditor();

    $this->actingAs($editor)->getJson(CP.'/posts')->assertOk()->assertJsonPath('meta.total', 3);
    $this->actingAs($editor)->getJson(CP.'/posts?status=draft')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.title', 'Brouillon secourisme');
    $this->actingAs($editor)->getJson(CP.'/posts?category=formation')->assertJsonPath('meta.total', 2);
    $this->actingAs($editor)->getJson(CP.'/posts?q=incendie')->assertJsonPath('meta.total', 1);
    $this->actingAs($editor)->getJson(CP.'/posts?status=public')->assertStatus(422)->assertJsonValidationErrors(['status']);
    $json = $this->actingAs($editor)->getJson(CP.'/posts')->getContent();
    expect($json)->not->toContain('@')->not->toContain('"body"');
});

it('affiche, modifie partiellement et supprime logiquement un article', function () {
    $editor = makeEditor();
    $post = Post::factory()->create(['category_id' => PostCategory::factory(), 'title' => 'Ancien titre', 'slug' => 'ancien-titre']);

    $this->actingAs($editor)->getJson(CP.'/posts/'.$post->id)->assertOk()->assertJsonPath('data.title', 'Ancien titre')->assertJsonStructure(['data' => ['body', 'category' => ['id', 'slug', 'name'], 'cover']]);

    $this->actingAs($editor)->patchJson(CP.'/posts/'.$post->id, ['title' => 'Nouveau titre', 'is_featured' => true])->assertOk()
        ->assertJsonPath('data.title', 'Nouveau titre')->assertJsonPath('data.slug', 'ancien-titre')->assertJsonPath('data.is_featured', true);
    expect($post->refresh()->status)->toBe('published')->and($post->is_visible)->toBeTrue()->and(AuditLog::where('event', 'post_updated')->count())->toBe(1);

    $this->actingAs($editor)->patchJson(CP.'/posts/'.$post->id, ['status' => 'archived'])->assertOk();
    expect($post->refresh()->is_visible)->toBeFalse();
    $this->getJson('/api/v1/blog/posts/'.$post->slug)->assertNotFound();

    $this->actingAs($editor)->deleteJson(CP.'/posts/'.$post->id)->assertNoContent();
    expect(Post::withTrashed()->find($post->id)->trashed())->toBeTrue()->and(AuditLog::where('event', 'post_deleted')->count())->toBe(1);
    $this->actingAs($editor)->getJson(CP.'/posts/'.$post->id)->assertNotFound();
    $this->actingAs($editor)->patchJson(CP.'/posts/999999', ['title' => 'Inconnu'])->assertNotFound();
});

it('valide la modification partielle', function () {
    $post = Post::factory()->create(['category_id' => PostCategory::factory()]);

    $this->actingAs(makeEditor())->patchJson(CP.'/posts/'.$post->id, ['title' => '', 'status' => 'xx'])->assertStatus(422)->assertJsonValidationErrors(['title', 'status']);
});

it('ne met jamais le corps de l\'article dans le journal d\'audit', function () {
    $this->actingAs(makeEditor())->postJson(CP.'/posts', validPost(['body' => '<p>Contenu confidentiel du brouillon</p>']))->assertCreated();

    expect(json_encode(AuditLog::all()->toArray()))->not->toContain('Contenu confidentiel');
});

// --- Médias -------------------------------------------------------------------------------------------------------

it('envoie une image, la ré-encode en WebP et la rattache comme couverture', function () {
    Storage::fake('public');
    config(['establishments.media_disk' => 'public']);
    $editor = makeEditor();

    $upload = $this->actingAs($editor)->post(CP.'/media', ['file' => UploadedFile::fake()->createWithContent('photo.png', pngBytes()), 'alt' => 'Agent à l\'entrée'], ['Accept' => 'application/json'])
        ->assertCreated();

    $media = Media::findOrFail($upload->json('data.id'));
    expect($upload->json('data.alt'))->toBe('Agent à l\'entrée')->and($media->mime_type)->toBe('image/webp')->and($media->path)->toEndWith('.webp')
        ->and($media->collection)->toBe('content');
    Storage::disk('public')->assertExists($media->path);

    $post = $this->actingAs($editor)->postJson(CP.'/posts', validPost(['cover_media_id' => $media->id]))->assertCreated();
    expect($post->json('data.cover.id'))->toBe($media->id)->and($media->refresh()->collection)->toBe('cover')->and($media->mediable_type)->toBe('post');

    // Le média d'un autre utilisateur n'est pas rattachable.
    $foreign = $this->actingAs(makeAdmin())->post(CP.'/media', ['file' => UploadedFile::fake()->createWithContent('b.png', pngBytes()), 'alt' => 'Autre image'], ['Accept' => 'application/json'])->assertCreated();
    $this->actingAs($editor)->postJson(CP.'/posts', validPost(['cover_media_id' => $foreign->json('data.id')]))->assertStatus(422)->assertJsonValidationErrors(['cover_media_id']);
});

it('refuse un fichier qui n\'est pas une image ou sans texte alternatif', function () {
    Storage::fake('public');
    $editor = makeEditor();

    $this->actingAs($editor)->post(CP.'/media', ['file' => UploadedFile::fake()->createWithContent('page.html', '<script>alert(1)</script>'), 'alt' => 'Piège'], ['Accept' => 'application/json'])
        ->assertStatus(422);
    $this->actingAs($editor)->post(CP.'/media', ['file' => UploadedFile::fake()->createWithContent('photo.png', pngBytes())], ['Accept' => 'application/json'])
        ->assertStatus(422)->assertJsonValidationErrors(['alt']);
    $this->actingAs($editor)->post(CP.'/media', ['alt' => 'Sans fichier'], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['file']);
    expect(Media::count())->toBe(0);
});
