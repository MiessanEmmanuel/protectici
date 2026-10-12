<?php

use App\Models\AuditLog;
use App\Models\Media;
use App\Models\NewsletterSubscriber;
use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\PostComment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const CA = '/api/v1/content';

function pendingComment(?Post $post = null, array $overrides = []): PostComment
{
    $post ??= Post::factory()->create(['category_id' => PostCategory::factory()]);
    $comment = new PostComment(['post_id' => $post->id, 'body' => $overrides['body'] ?? 'Un commentaire à modérer.', 'parent_id' => $overrides['parent_id'] ?? null]);
    $comment->forceFill([
        'user_id' => User::factory()->create(['first_name' => 'Aminata', 'last_name' => 'Traoré', 'email' => 'aminata.secrete'.fake()->unique()->numerify('####').'@exemple.test'])->id,
        'status' => $overrides['status'] ?? 'pending', 'is_visible' => ($overrides['status'] ?? 'pending') === 'approved',
    ])->save();

    return $comment;
}

// --- Commentaires -------------------------------------------------------------------------------------------------

it('liste les commentaires en attente par défaut, sans e-mail, et filtre par statut', function () {
    pendingComment();
    pendingComment(null, ['status' => 'approved']);
    $editor = makeEditor();

    $response = $this->actingAs($editor)->getJson(CA.'/comments')->assertOk()->assertJsonPath('meta.total', 1);
    expect($response->json('data.0.author_name'))->toBe('Aminata T.')->and($response->getContent())->not->toContain('secrete');
    $this->actingAs($editor)->getJson(CA.'/comments?status=approved')->assertJsonPath('meta.total', 1);
    $this->actingAs($editor)->getJson(CA.'/comments?status=autre')->assertStatus(422)->assertJsonValidationErrors(['status']);
});

it('approuve, rejette et marque comme indésirable un commentaire, avec audit', function () {
    $editor = makeEditor();
    $comment = pendingComment();

    $this->actingAs($editor)->patchJson(CA.'/comments/'.$comment->id, ['status' => 'approved'])->assertOk()->assertJsonPath('data.status', 'approved');
    $comment->refresh();
    expect($comment->is_visible)->toBeTrue()->and($comment->moderated_by)->toBe($editor->id)->and($comment->moderated_at)->not->toBeNull();
    $this->getJson('/api/v1/blog/posts/'.$comment->post->slug.'/comments')->assertJsonCount(1, 'data');

    $this->actingAs($editor)->patchJson(CA.'/comments/'.$comment->id, ['status' => 'spam'])->assertOk();
    expect($comment->refresh()->is_visible)->toBeFalse()->and($comment->status)->toBe('spam');
    $this->getJson('/api/v1/blog/posts/'.$comment->post->slug.'/comments')->assertJsonCount(0, 'data');

    $this->actingAs($editor)->patchJson(CA.'/comments/'.$comment->id, ['status' => 'spam'])->assertOk(); // idempotent
    expect(AuditLog::where('event', 'post_comment_moderated')->count())->toBe(2);
});

it('masque les réponses d\'un commentaire racine rejeté', function () {
    $root = pendingComment(null, ['status' => 'approved']);
    $reply = pendingComment($root->post, ['status' => 'approved', 'parent_id' => $root->id]);

    $this->actingAs(makeAdmin())->patchJson(CA.'/comments/'.$root->id, ['status' => 'rejected'])->assertOk();

    expect($reply->refresh()->is_visible)->toBeFalse();
});

it('valide la modération et répond 404 pour un commentaire inconnu', function () {
    $comment = pendingComment();
    $editor = makeEditor();

    $this->actingAs($editor)->patchJson(CA.'/comments/'.$comment->id, ['status' => 'pending'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    $this->actingAs($editor)->patchJson(CA.'/comments/'.$comment->id, [])->assertStatus(422);
    $this->actingAs($editor)->patchJson(CA.'/comments/999999', ['status' => 'approved'])->assertNotFound();
});

// --- Pages --------------------------------------------------------------------------------------------------------

it('laisse l\'éditeur lire les pages mais seul l\'administrateur les modifier', function () {
    Page::factory()->create(['slug' => 'cgu', 'title' => 'CGU', 'body' => '', 'is_visible' => false]);
    $payload = ['title' => 'Conditions générales', 'body' => '<h2>Objet</h2><p>Texte <script>x()</script>officiel.</p>', 'seo_title' => 'CGU ProtectIci', 'seo_description' => null, 'is_visible' => true];

    $this->actingAs(makeEditor())->getJson(CA.'/pages')->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs(makeEditor())->getJson(CA.'/pages/cgu')->assertOk()->assertJsonPath('data.title', 'CGU');
    $this->actingAs(makeEditor())->putJson(CA.'/pages/cgu', $payload)->assertForbidden();
    expect(Page::firstOrFail()->is_visible)->toBeFalse();

    $admin = makeAdmin();
    $this->actingAs($admin)->putJson(CA.'/pages/cgu', $payload)->assertOk()->assertJsonPath('data.is_visible', true);

    $page = Page::firstOrFail();
    expect($page->body)->toBe('<h2>Objet</h2><p>Texte officiel.</p>')->and($page->updated_by)->toBe($admin->id);
    expect(AuditLog::where('event', 'page_updated')->count())->toBe(1);
    $this->getJson('/api/v1/pages/cgu')->assertOk()->assertJsonPath('data.title', 'Conditions générales');
});

it('valide la page et refuse de publier une page vide', function () {
    Page::factory()->create(['slug' => 'cgu']);
    $admin = makeAdmin();

    $this->actingAs($admin)->putJson(CA.'/pages/cgu', [])->assertStatus(422)->assertJsonValidationErrors(['title', 'body', 'is_visible']);
    $this->actingAs($admin)->putJson(CA.'/pages/cgu', ['title' => 'CGU', 'body' => '<script>x()</script>', 'is_visible' => true])->assertStatus(422)->assertJsonValidationErrors(['body']);
    $this->actingAs($admin)->putJson(CA.'/pages/inconnue', ['title' => 'Titre', 'body' => '<p>a</p>', 'is_visible' => true])->assertNotFound();
});

// --- Partenaires --------------------------------------------------------------------------------------------------

it('réserve les partenaires et clients à l\'administrateur', function () {
    $partner = Partner::factory()->create();
    $editor = makeEditor();

    $this->actingAs($editor)->getJson(CA.'/partners')->assertForbidden();
    $this->actingAs($editor)->postJson(CA.'/partners', ['type' => 'partner', 'name' => 'Nouveau'])->assertForbidden();
    $this->actingAs($editor)->patchJson(CA.'/partners/'.$partner->id, ['name' => 'Modifié'])->assertForbidden();
    $this->actingAs($editor)->deleteJson(CA.'/partners/'.$partner->id)->assertForbidden();
    expect($partner->refresh()->name)->not->toBe('Modifié')->and(Partner::count())->toBe(1);
});

it('gère le cycle de vie complet d\'un partenaire, logo compris', function () {
    Storage::fake('public');
    config(['establishments.media_disk' => 'public']);
    $admin = makeAdmin();
    $logo = $this->actingAs($admin)->post(CA.'/media', ['file' => UploadedFile::fake()->createWithContent('logo.png', pngBytes()), 'alt' => 'Logo du partenaire'], ['Accept' => 'application/json'])->assertCreated();

    $created = $this->actingAs($admin)->postJson(CA.'/partners', [
        'type' => 'partner', 'name' => 'Association <b>Sécurité</b> Plus', 'website_url' => 'https://securite-plus.test',
        'description' => 'Réseau fictif.', 'sort_order' => 2, 'is_visible' => true, 'logo_media_id' => $logo->json('data.id'),
    ])->assertCreated();

    $id = $created->json('data.id');
    expect($created->json('data.name'))->toBe('Association Sécurité Plus')->and($created->json('data.logo_url'))->toBe($logo->json('data.url'));
    expect(Media::find($logo->json('data.id'))->mediable_type)->toBe('partner');
    $this->getJson('/api/v1/partners')->assertJsonCount(1, 'data')->assertJsonPath('data.0.logo_url', $logo->json('data.url'));

    $this->actingAs($admin)->patchJson(CA.'/partners/'.$id, ['is_visible' => false, 'logo_media_id' => null])->assertOk()->assertJsonPath('data.logo_url', null);
    $this->getJson('/api/v1/partners')->assertJsonCount(0, 'data');
    $this->actingAs($admin)->getJson(CA.'/partners/'.$id)->assertOk()->assertJsonPath('data.is_visible', false);
    $this->actingAs($admin)->getJson(CA.'/partners')->assertJsonCount(1, 'data');

    $this->actingAs($admin)->deleteJson(CA.'/partners/'.$id)->assertNoContent();
    $this->actingAs($admin)->getJson(CA.'/partners/'.$id)->assertNotFound();
    expect(AuditLog::whereIn('event', ['partner_created', 'partner_updated', 'partner_deleted'])->count())->toBe(3);
});

it('valide les partenaires et ignore les champs protégés', function (array $payload, string $field) {
    $this->actingAs(makeAdmin())->postJson(CA.'/partners', $payload + ['type' => 'client', 'name' => 'Valide'])->assertStatus(422)->assertJsonValidationErrors([$field]);
})->with([
    'type inconnu' => [['type' => 'ami'], 'type'],
    'nom trop court' => [['name' => 'A'], 'name'],
    'url javascript' => [['website_url' => 'javascript:alert(1)'], 'website_url'],
    'url sans schéma' => [['website_url' => 'exemple.test'], 'website_url'],
    'ordre négatif' => [['sort_order' => -1], 'sort_order'],
    'logo inconnu' => [['logo_media_id' => 'abc'], 'logo_media_id'],
]);

it('refuse un logo qui n\'appartient pas à l\'administrateur', function () {
    $foreign = (new Media)->forceFill([
        'mediable_type' => 'user', 'mediable_id' => User::factory()->create()->id, 'collection' => 'content', 'disk' => 'public', 'path' => 'content/9/x.webp',
        'original_name' => 'x.webp', 'mime_type' => 'image/webp', 'size_bytes' => 10, 'width' => 1, 'height' => 1, 'alt_text' => 'x', 'sort_order' => 0,
    ]);
    $foreign->save();

    $this->actingAs(makeAdmin())->postJson(CA.'/partners', ['type' => 'client', 'name' => 'Valide', 'logo_media_id' => $foreign->id])
        ->assertStatus(422)->assertJsonValidationErrors(['logo_media_id']);
    expect(Partner::count())->toBe(0);
});

// --- Catégories ---------------------------------------------------------------------------------------------------

it('liste et modifie les catégories pour l\'éditeur, sans changer le slug', function () {
    $category = PostCategory::factory()->create(['slug' => 'formation', 'name' => 'Formation']);
    Post::factory()->create(['category_id' => $category->id]);
    $editor = makeEditor();

    $this->actingAs($editor)->getJson(CA.'/categories')->assertOk()->assertJsonPath('data.0.posts_count', 1);
    $this->actingAs($editor)->getJson(CA.'/categories/'.$category->id)->assertOk()->assertJsonPath('data.slug', 'formation');
    $this->actingAs($editor)->patchJson(CA.'/categories/'.$category->id, ['name' => 'Formations', 'description' => 'Tout sur <i>la</i> formation', 'sort_order' => 3, 'is_visible' => false, 'slug' => 'pirate'])
        ->assertOk()->assertJsonPath('data.name', 'Formations')->assertJsonPath('data.slug', 'formation')->assertJsonPath('data.is_visible', false);
    expect($category->refresh()->description)->toBe('Tout sur la formation')->and(AuditLog::where('event', 'post_category_updated')->count())->toBe(1);
    $this->getJson('/api/v1/blog/categories')->assertJsonCount(0, 'data');
});

it('valide les catégories et répond 404 pour une catégorie inconnue', function () {
    $category = PostCategory::factory()->create();
    $editor = makeEditor();

    $this->actingAs($editor)->patchJson(CA.'/categories/'.$category->id, ['name' => 'A', 'sort_order' => 'x', 'is_visible' => 'non'])
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'sort_order', 'is_visible']);
    $this->actingAs($editor)->patchJson(CA.'/categories/999999', ['name' => 'Valide'])->assertNotFound();
});

// --- Paramètres ---------------------------------------------------------------------------------------------------

it('lit et enregistre les paramètres (admin), avec audit et liste blanche des clés', function () {
    $admin = makeAdmin();

    $this->actingAs($admin)->getJson('/api/v1/admin/settings')->assertOk()->assertJsonPath('data.0.key', 'contact.phone');

    $this->actingAs($admin)->putJson('/api/v1/admin/settings', ['settings' => [
        ['key' => 'contact.phone', 'value' => '+225 07 09 44 51 11', 'is_public' => true],
        ['key' => 'contact.email', 'value' => 'info@exemple.test', 'is_public' => false],
        ['key' => 'social.facebook', 'value' => 'https://www.facebook.com/protectici.test'],
    ]])->assertOk();

    expect(Setting::find('contact.phone')->value)->toBe('+225 07 09 44 51 11')->and(Setting::find('contact.email')->is_public)->toBeFalse()
        ->and(Setting::find('contact.phone')->updated_by)->toBe($admin->id);
    expect(AuditLog::where('event', 'setting_updated')->count())->toBe(3);
    $this->getJson('/api/v1/settings/public')->assertExactJson(['data' => [
        'contact.phone' => '+225 07 09 44 51 11', 'social.facebook' => 'https://www.facebook.com/protectici.test',
    ]]);
});

it('refuse les clés hors liste blanche et les valeurs invalides', function (array $item, string $field) {
    $this->actingAs(makeAdmin())->putJson('/api/v1/admin/settings', ['settings' => [$item]])->assertStatus(422)->assertJsonValidationErrors([$field]);
    expect(Setting::count())->toBe(0);
})->with([
    'clé inconnue' => [['key' => 'app.key', 'value' => 'x'], 'settings.0.key'],
    'e-mail invalide' => [['key' => 'contact.email', 'value' => 'pas-un-email'], 'settings.0.value'],
    'téléphone invalide' => [['key' => 'contact.phone', 'value' => '<script>'], 'settings.0.value'],
    'réseau social http' => [['key' => 'social.facebook', 'value' => 'http://exemple.test'], 'settings.0.value'],
    'réseau social javascript' => [['key' => 'social.twitter', 'value' => 'javascript:alert(1)'], 'settings.0.value'],
    'valeur absente' => [['key' => 'site.name'], 'settings.0.value'],
    'visibilité invalide' => [['key' => 'site.name', 'value' => 'X', 'is_public' => 'peut-être'], 'settings.0.is_public'],
]);

it('exige au moins un paramètre', function () {
    $this->actingAs(makeAdmin())->putJson('/api/v1/admin/settings', [])->assertStatus(422)->assertJsonValidationErrors(['settings']);
});

it('interdit les paramètres à un compte non administrateur et sans session', function () {
    $this->getJson('/api/v1/admin/settings')->assertUnauthorized();
    $this->actingAs(User::factory()->create())->putJson('/api/v1/admin/settings', ['settings' => [['key' => 'site.name', 'value' => 'X']]])->assertForbidden();
    $this->actingAs(makeEditor())->putJson('/api/v1/admin/settings', ['settings' => [['key' => 'site.name', 'value' => 'X']]])->assertForbidden();
    expect(Setting::count())->toBe(0);
});

// --- Abonnés ------------------------------------------------------------------------------------------------------

it('liste les abonnés avec leur e-mail pour l\'administrateur, avec filtres et audit', function () {
    NewsletterSubscriber::forceCreate(['email' => 'un@exemple.test', 'status' => 'confirmed', 'consent_at' => now(), 'confirmed_at' => now(), 'ip_hash' => str_repeat('a', 64)]);
    NewsletterSubscriber::forceCreate(['email' => 'deux@exemple.test', 'status' => 'pending', 'consent_at' => now()]);
    $admin = makeAdmin();

    $response = $this->actingAs($admin)->getJson('/api/v1/admin/newsletter/subscribers')->assertOk()->assertJsonPath('meta.total', 2);
    expect(array_keys($response->json('data.0')))->toBe(['id', 'email', 'status', 'source', 'consent_at', 'confirmed_at', 'unsubscribed_at', 'created_at'])
        ->and($response->getContent())->not->toContain('ip_hash')->not->toContain('confirmation_token');
    $this->actingAs($admin)->getJson('/api/v1/admin/newsletter/subscribers?status=confirmed')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.email', 'un@exemple.test');
    $this->actingAs($admin)->getJson('/api/v1/admin/newsletter/subscribers?q=deux')->assertJsonPath('meta.total', 1);
    $this->actingAs($admin)->getJson('/api/v1/admin/newsletter/subscribers?status=autre')->assertStatus(422)->assertJsonValidationErrors(['status']);
    expect(AuditLog::where('event', 'newsletter_subscribers_listed')->count())->toBeGreaterThan(0);
});

it('interdit la liste des abonnés à un non-administrateur', function () {
    NewsletterSubscriber::forceCreate(['email' => 'un@exemple.test', 'status' => 'confirmed', 'consent_at' => now()]);

    $this->getJson('/api/v1/admin/newsletter/subscribers')->assertUnauthorized();
    $this->actingAs(User::factory()->create())->getJson('/api/v1/admin/newsletter/subscribers')->assertForbidden();
    $this->actingAs(makeEditor())->getJson('/api/v1/admin/newsletter/subscribers')->assertForbidden();
});

// --- Tableau de bord ----------------------------------------------------------------------------------------------

it('ajoute pending_comments et confirmed_subscribers au tableau de bord', function () {
    pendingComment();
    pendingComment();
    pendingComment(null, ['status' => 'approved']);
    NewsletterSubscriber::forceCreate(['email' => 'un@exemple.test', 'status' => 'confirmed', 'consent_at' => now()]);
    NewsletterSubscriber::forceCreate(['email' => 'deux@exemple.test', 'status' => 'pending', 'consent_at' => now()]);

    $this->actingAs(makeAdmin())->getJson('/api/v1/admin/dashboard')->assertOk()
        ->assertJsonPath('data.pending_comments', 2)->assertJsonPath('data.confirmed_subscribers', 1);
});
