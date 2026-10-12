<?php

use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\PostComment;
use App\Models\Setting;
use App\Models\User;

const BLOG = '/api/v1/blog';

function postIn(PostCategory $category, array $attributes = []): Post
{
    return Post::factory()->create($attributes + ['category_id' => $category->id]);
}

it('liste les catégories visibles avec le nombre d\'articles publiés', function () {
    $visible = PostCategory::factory()->create(['name' => 'Cybercriminalité', 'slug' => 'cybercriminalite']);
    PostCategory::factory()->create(['is_visible' => false]);
    postIn($visible);
    postIn($visible);
    postIn($visible, ['status' => 'draft', 'published_at' => null, 'is_visible' => false]);
    postIn($visible, ['status' => 'scheduled', 'published_at' => now()->addDay(), 'is_visible' => false]);

    $response = $this->getJson(BLOG.'/categories')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0'))->toBe(['slug' => 'cybercriminalite', 'name' => 'Cybercriminalité', 'description' => null, 'posts_count' => 2]);
});

it('liste les articles publiés, du plus récent au plus ancien, avec le format PostCard', function () {
    $category = PostCategory::factory()->create();
    $old = postIn($category, ['published_at' => now()->subDays(5)]);
    $new = postIn($category, ['published_at' => now()->subDay(), 'is_featured' => true]);
    postIn($category, ['status' => 'draft', 'published_at' => null, 'is_visible' => false]);
    postIn($category, ['status' => 'archived', 'is_visible' => false]);
    postIn($category, ['published_at' => now()->addDay()]); // date future : pas encore publié

    $response = $this->getJson(BLOG.'/posts')->assertOk()->assertJsonPath('meta.total', 2);

    expect(array_column($response->json('data'), 'slug'))->toBe([$new->slug, $old->slug]);
    expect(array_keys($response->json('data.0')))->toEqualCanonicalizing(['slug', 'title', 'excerpt', 'category', 'cover_url', 'cover_alt', 'published_at', 'reading_minutes', 'views_count', 'is_featured', 'author_name'])
        ->and($response->json('data.0.is_featured'))->toBeTrue();
});

it('masque les articles d\'une catégorie non visible', function () {
    $hidden = PostCategory::factory()->create(['is_visible' => false]);
    $post = postIn($hidden);

    $this->getJson(BLOG.'/posts')->assertOk()->assertJsonPath('meta.total', 0);
    $this->getJson(BLOG.'/posts/'.$post->slug)->assertNotFound();
});

it('filtre par catégorie, à la une, et trie par popularité', function () {
    $a = PostCategory::factory()->create(['slug' => 'domotique']);
    $b = PostCategory::factory()->create();
    $low = postIn($a, ['views_count' => 5, 'published_at' => now()->subDays(1)]);
    $high = postIn($a, ['views_count' => 500, 'published_at' => now()->subDays(9), 'is_featured' => true]);
    postIn($b);

    expect(array_column($this->getJson(BLOG.'/posts?category=domotique')->json('data'), 'slug'))->toBe([$low->slug, $high->slug]);
    expect(array_column($this->getJson(BLOG.'/posts?category=domotique&sort=popular')->json('data'), 'slug'))->toBe([$high->slug, $low->slug]);
    expect(array_column($this->getJson(BLOG.'/posts?featured=1')->json('data'), 'slug'))->toBe([$high->slug]);
});

it('recherche en plein texte, sans tenir compte des accents ni de la casse', function () {
    $category = PostCategory::factory()->create();
    $match = postIn($category, ['title' => 'Prévention incendie dans les commerces', 'excerpt' => 'Extincteurs et issues de secours', 'body' => '<p>Contenu quelconque</p>']);
    postIn($category, ['title' => 'Alarmes domestiques', 'excerpt' => 'Capteurs', 'body' => '<p>Détecteurs</p>']);
    postIn($category, ['title' => 'Incendie non publié', 'status' => 'draft', 'published_at' => null, 'is_visible' => false]);

    foreach (['prevention INCENDIE', 'incendies', 'extincteur'] as $q) {
        $slugs = array_column($this->getJson(BLOG.'/posts?q='.urlencode($q))->assertOk()->json('data'), 'slug');
        expect($slugs)->toBe([$match->slug]);
    }
    // Saisie hostile : aucune erreur de syntaxe, simplement aucun résultat.
    $this->getJson(BLOG.'/posts?q='.urlencode("'); DROP TABLE posts; -- & | ! ("))->assertOk();
    expect(Post::count())->toBe(3);
});

it('valide les paramètres de liste', function (string $query, string $field) {
    $this->getJson(BLOG.'/posts?'.$query)->assertStatus(422)->assertJsonValidationErrors([$field]);
})->with([
    'per_page trop grand' => ['per_page=25', 'per_page'],
    'tri inconnu' => ['sort=views', 'sort'],
    'recherche trop longue' => ['q='.str_repeat('a', 101), 'q'],
    'catégorie invalide' => ['category=A%20B', 'category'],
    'page nulle' => ['page=0', 'page'],
]);

it('affiche un article avec ses articles liés et compte une vue par fenêtre de 30 minutes', function () {
    $category = PostCategory::factory()->create();
    $post = postIn($category, ['views_count' => 10, 'body' => '<p>Texte de l\'article</p>', 'seo_title' => 'Titre SEO']);
    $siblings = Post::factory()->count(4)->create(['category_id' => $category->id]);
    $author = User::factory()->editor()->create(['first_name' => 'Koffi', 'last_name' => 'Éditeur']);
    $post->forceFill(['author_id' => $author->id])->save();

    $response = $this->getJson(BLOG.'/posts/'.$post->slug)->assertOk();

    $data = $response->json('data');
    expect($data['body'])->toBe('<p>Texte de l\'article</p>')
        ->and($data['seo_title'])->toBe('Titre SEO')
        ->and($data['author_name'])->toBe('Koffi É.')
        ->and($data['views_count'])->toBe(11)
        ->and($data['related'])->toHaveCount(3)
        ->and(array_column($data['related'], 'slug'))->not->toContain($post->slug)
        ->and(json_encode($data))->not->toContain('@');

    // Même visiteur : pas de nouvelle vue ; autre visiteur : nouvelle vue.
    $this->getJson(BLOG.'/posts/'.$post->slug)->assertOk()->assertJsonPath('data.views_count', 11);
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson(BLOG.'/posts/'.$post->slug)->assertOk()->assertJsonPath('data.views_count', 12);
    expect($post->refresh()->views_count)->toBe(12);

    $this->travel(31)->minutes();
    $this->getJson(BLOG.'/posts/'.$post->slug)->assertOk()->assertJsonPath('data.views_count', 13);
});

it('répond 404 pour un article non publié, planifié, archivé ou inconnu', function (array $state) {
    $post = Post::factory()->create($state + ['category_id' => PostCategory::factory()]);

    $this->getJson(BLOG.'/posts/'.$post->slug)->assertNotFound();
    expect($post->refresh()->views_count)->toBe(0);
})->with([
    'brouillon' => [['status' => 'draft', 'published_at' => null, 'is_visible' => false]],
    'planifié' => [['status' => 'scheduled', 'published_at' => '+1 day', 'is_visible' => false]],
    'archivé' => [['status' => 'archived', 'is_visible' => false]],
    'invisible' => [['is_visible' => false]],
]);

it('répond 404 pour un article supprimé ou un slug invalide', function () {
    $post = postIn(PostCategory::factory()->create());
    $post->delete();

    $this->getJson(BLOG.'/posts/'.$post->slug)->assertNotFound();
    $this->getJson(BLOG.'/posts/inconnu')->assertNotFound();
    $this->getJson(BLOG.'/posts/Slug_Invalide')->assertNotFound();
});

it('renvoie le bandeau flash : articles publiés is_flash, 10 au plus, récents d\'abord', function () {
    $category = PostCategory::factory()->create();
    foreach (range(1, 12) as $i) {
        postIn($category, ['is_flash' => true, 'published_at' => now()->subHours($i)]);
    }
    postIn($category, ['is_flash' => false]);
    postIn($category, ['is_flash' => true, 'status' => 'draft', 'published_at' => null, 'is_visible' => false]);

    $data = $this->getJson(BLOG.'/flash')->assertOk()->json('data');

    expect($data)->toHaveCount(10)->and(array_keys($data[0]))->toBe(['slug', 'title', 'published_at']);
    expect(array_column($data, 'published_at'))->toBe(collect(array_column($data, 'published_at'))->sortDesc()->values()->all());
});

// --- Commentaires publics ---------------------------------------------------------------------------------------

function commentOn(Post $post, array $attributes = []): PostComment
{
    $comment = new PostComment(['post_id' => $post->id, 'body' => $attributes['body'] ?? 'Un commentaire utile.', 'parent_id' => $attributes['parent_id'] ?? null]);
    $comment->forceFill([
        'user_id' => $attributes['user_id'] ?? User::factory()->create(['first_name' => 'Aminata', 'last_name' => 'Traoré'])->id,
        'status' => $attributes['status'] ?? 'approved',
        'is_visible' => ($attributes['status'] ?? 'approved') === 'approved',
    ])->save();

    return $comment;
}

it('liste uniquement les commentaires approuvés avec leurs réponses, sans e-mail', function () {
    $post = postIn(PostCategory::factory()->create());
    $root = commentOn($post, ['body' => 'Racine approuvée']);
    commentOn($post, ['body' => 'Réponse approuvée', 'parent_id' => $root->id]);
    commentOn($post, ['body' => 'Réponse en attente', 'parent_id' => $root->id, 'status' => 'pending']);
    commentOn($post, ['body' => 'En attente', 'status' => 'pending']);
    commentOn($post, ['body' => 'Rejeté', 'status' => 'rejected']);

    $response = $this->getJson(BLOG.'/posts/'.$post->slug.'/comments')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.body'))->toBe('Racine approuvée')
        ->and($response->json('data.0.author_name'))->toBe('Aminata T.')
        ->and($response->json('data.0.replies'))->toHaveCount(1)
        ->and($response->json('data.0.replies.0.body'))->toBe('Réponse approuvée')
        ->and(json_encode($response->json()))->not->toContain('@')->not->toContain('user_id');
});

it('crée un commentaire en attente de modération pour un compte vérifié', function () {
    $post = postIn(PostCategory::factory()->create());
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => "  Merci pour cet <b>article</b>.\n"])
        ->assertCreated()->assertExactJson(['data' => ['status' => 'pending']]);

    $comment = PostComment::first();
    expect($comment->status)->toBe('pending')->and($comment->is_visible)->toBeFalse()
        ->and($comment->user_id)->toBe($user->id)->and($comment->body)->toBe('Merci pour cet article.');
    $this->getJson(BLOG.'/posts/'.$post->slug.'/comments')->assertJsonCount(0, 'data');
});

it('refuse le commentaire sans compte (401), avec un e-mail non vérifié (403) et sur un article non publié (404)', function () {
    $post = postIn(PostCategory::factory()->create());
    $draft = postIn(PostCategory::factory()->create(), ['status' => 'draft', 'published_at' => null, 'is_visible' => false]);

    $this->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Bonjour'])->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Bonjour'])->assertForbidden();
    $this->actingAs(User::factory()->create())->postJson(BLOG.'/posts/'.$draft->slug.'/comments', ['body' => 'Bonjour'])->assertNotFound();
    expect(PostComment::count())->toBe(0);
});

it('valide le commentaire', function (array $payload, string $field) {
    $post = postIn(PostCategory::factory()->create());

    $this->actingAs(User::factory()->create())->postJson(BLOG.'/posts/'.$post->slug.'/comments', $payload)
        ->assertStatus(422)->assertJsonValidationErrors([$field]);
})->with([
    'vide' => [[], 'body'],
    'trop court' => [['body' => 'a'], 'body'],
    'trop long' => [['body' => str_repeat('a', 2001)], 'body'],
    'parent inconnu' => [['body' => 'Bonjour', 'parent_id' => 999999], 'parent_id'],
]);

it('limite les réponses à un niveau et au même article', function () {
    $post = postIn(PostCategory::factory()->create());
    $other = postIn(PostCategory::factory()->create());
    $root = commentOn($post);
    $reply = commentOn($post, ['parent_id' => $root->id]);
    $foreign = commentOn($other);
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Bonne réponse', 'parent_id' => $root->id])->assertCreated();
    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Trop profond', 'parent_id' => $reply->id])->assertStatus(422)->assertJsonValidationErrors(['parent_id']);
    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Autre article', 'parent_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors(['parent_id']);
});

it('simule le succès sans rien enregistrer quand le champ piège est rempli', function () {
    $post = postIn(PostCategory::factory()->create());

    $this->actingAs(User::factory()->create())->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Spam du robot', 'company_website' => 'https://spam.test'])
        ->assertCreated()->assertExactJson(['data' => ['status' => 'pending']]);

    expect(PostComment::count())->toBe(0);
});

it('applique Idempotency-Key : deux envois identiques créent un seul commentaire', function () {
    $post = postIn(PostCategory::factory()->create());
    $user = User::factory()->create();
    $headers = ['Idempotency-Key' => 'cle-test-0001'];

    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Un seul envoi'], $headers)->assertCreated();
    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Un seul envoi'], $headers)->assertCreated();
    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Autre contenu'], $headers)->assertStatus(422);

    expect(PostComment::count())->toBe(1);
});

it('limite les commentaires à 5 par heure et par utilisateur', function () {
    $post = postIn(PostCategory::factory()->create());
    $user = User::factory()->create();

    foreach (range(1, 5) as $i) {
        $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => "Commentaire numéro {$i}"])->assertCreated();
    }
    $this->actingAs($user)->postJson(BLOG.'/posts/'.$post->slug.'/comments', ['body' => 'Commentaire de trop'])->assertStatus(429)->assertHeader('Retry-After');
});

// --- Pages, partenaires, paramètres -----------------------------------------------------------------------------

it('sert une page institutionnelle visible uniquement', function () {
    Page::factory()->create(['slug' => 'qui-sommes-nous', 'title' => 'Qui sommes-nous', 'body' => '<p>Notre mission</p>', 'seo_title' => 'SEO']);
    Page::factory()->create(['slug' => 'cgu', 'is_visible' => false]);

    $this->getJson('/api/v1/pages/qui-sommes-nous')->assertOk()
        ->assertJsonStructure(['data' => ['slug', 'title', 'body', 'seo_title', 'seo_description', 'updated_at']])
        ->assertJsonPath('data.body', '<p>Notre mission</p>');
    $this->getJson('/api/v1/pages/cgu')->assertNotFound();
    $this->getJson('/api/v1/pages/inconnue')->assertNotFound();
});

it('liste les partenaires et clients visibles, filtrables par type', function () {
    Partner::factory()->create(['type' => 'partner', 'name' => 'Beta', 'sort_order' => 2]);
    Partner::factory()->create(['type' => 'partner', 'name' => 'Alpha', 'sort_order' => 1, 'website_url' => 'https://alpha.test']);
    Partner::factory()->create(['type' => 'client', 'name' => 'Client', 'sort_order' => 3]);
    Partner::factory()->create(['type' => 'client', 'is_visible' => false]);

    expect(array_column($this->getJson('/api/v1/partners')->assertOk()->json('data'), 'name'))->toBe(['Alpha', 'Beta', 'Client']);
    $partners = $this->getJson('/api/v1/partners?type=partner')->json('data');
    expect(array_column($partners, 'name'))->toBe(['Alpha', 'Beta'])
        ->and(array_keys($partners[0]))->toBe(['id', 'type', 'name', 'website_url', 'description', 'logo_url']);
    $this->getJson('/api/v1/partners?type=autre')->assertStatus(422);
});

it('n\'expose que les paramètres publics', function () {
    Setting::unguarded(function () {
        Setting::create(['key' => 'contact.phone', 'value' => '+225 07 00 00 00 00', 'is_public' => true]);
        Setting::create(['key' => 'contact.email', 'value' => 'prive@exemple.test', 'is_public' => false]);
        Setting::create(['key' => 'cle.inconnue', 'value' => 'x', 'is_public' => true]);
    });

    $this->getJson('/api/v1/settings/public')->assertOk()->assertExactJson(['data' => ['contact.phone' => '+225 07 00 00 00 00']]);
});

it('renvoie un objet vide quand aucun paramètre n\'est public', function () {
    expect($this->getJson('/api/v1/settings/public')->assertOk()->getContent())->toContain('"data":{}');
});
