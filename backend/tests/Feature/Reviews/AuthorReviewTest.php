<?php

use App\Models\AuditLog;
use App\Models\Provider;
use App\Models\Review;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
});

function reviewsPayload(array $overrides = []): array
{
    return array_merge(['rating' => 4, 'title' => 'Très bon service', 'body' => 'Équipe ponctuelle et professionnelle, je recommande.'], $overrides);
}

it('crée un avis en attente, masqué, et alerte les administrateurs', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $user = User::factory()->create();

    $res = $this->actingAs($user)->postJson("/api/v1/providers/{$provider->slug}/reviews", reviewsPayload([
        'title' => '<b>Super</b> prestataire', 'status' => 'approved', 'is_visible' => true, 'user_id' => 999,
    ]))->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.is_visible', false)
        ->assertJsonPath('data.title', 'Super prestataire')
        ->assertJsonPath('data.provider.slug', $provider->slug);
    expect($res->json('data'))->toHaveKeys(['id', 'provider', 'rating', 'title', 'body', 'status', 'rejection_reason', 'is_visible', 'created_at', 'provider_reply']);

    $review = Review::findOrFail($res->json('data.id'));
    expect($review->user_id)->toBe($user->id)->and($review->status)->toBe('pending')->and($review->is_visible)->toBeFalse();
    Notification::assertSentTo($admin, AdminAlert::class, fn ($n) => $n->kind === 'review_submitted' && $n->subject === ['type' => 'review', 'id' => $review->id]);

    $this->getJson("/api/v1/providers/{$provider->slug}/reviews")->assertOk()->assertJsonCount(0, 'data');
    expect($provider->fresh()->rating_count)->toBe(0);
});

it('refuse un second avis (409) mais autorise après suppression', function () {
    $provider = makeProvider();
    $user = User::factory()->create();
    $url = "/api/v1/providers/{$provider->slug}/reviews";

    $first = $this->actingAs($user)->postJson($url, reviewsPayload())->assertCreated()->json('data.id');
    $this->actingAs($user)->postJson($url, reviewsPayload())->assertStatus(409)
        ->assertJsonPath('message', 'Vous avez déjà donné un avis pour ce prestataire.');

    $this->actingAs($user)->deleteJson("/api/v1/me/reviews/{$first}")->assertNoContent();
    $this->actingAs($user)->postJson($url, reviewsPayload())->assertCreated();
});

it('valide la création de l\'avis (422)', function () {
    $provider = makeProvider();
    $user = User::factory()->create();
    $url = "/api/v1/providers/{$provider->slug}/reviews";

    $this->actingAs($user)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors(['rating', 'body']);
    $this->actingAs($user)->postJson($url, reviewsPayload(['rating' => 6]))->assertUnprocessable()->assertJsonValidationErrors(['rating']);
    $this->actingAs($user)->postJson($url, reviewsPayload(['body' => 'court']))->assertUnprocessable()->assertJsonValidationErrors(['body']);
    $this->actingAs($user)->postJson($url, reviewsPayload(['title' => str_repeat('a', 151)]))->assertUnprocessable()->assertJsonValidationErrors(['title']);
    $this->actingAs($user)->postJson($url, reviewsPayload(['body' => '<p>   </p>'.str_repeat(' ', 20)]))->assertUnprocessable();
    expect(Review::count())->toBe(0);
});

it('contrôle l\'accès à la création : 401, 403 non vérifié, 404 fiche non publiée, 403 propriétaire', function () {
    $provider = makeProvider();
    $url = "/api/v1/providers/{$provider->slug}/reviews";

    $this->postJson($url, reviewsPayload())->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->postJson($url, reviewsPayload())->assertForbidden();

    $hidden = Provider::factory()->pending()->create(['city_id' => $provider->city_id]);
    $this->actingAs(User::factory()->create())->postJson("/api/v1/providers/{$hidden->slug}/reviews", reviewsPayload())->assertNotFound();

    $owner = User::factory()->provider()->create();
    $own = makeProvider(['user_id' => $owner->id]);
    $this->actingAs($owner)->postJson("/api/v1/providers/{$own->slug}/reviews", reviewsPayload())->assertForbidden()
        ->assertJsonPath('message', 'Vous ne pouvez pas donner d\'avis sur votre propre fiche.');
    expect(Review::count())->toBe(0);
});

it('applique le limiteur review-create (429 avec Retry-After)', function () {
    config(['public_forms.reviews_per_day_per_user' => 2]);
    $user = User::factory()->create();

    foreach ([makeProvider(), makeProvider()] as $p) {
        $this->actingAs($user)->postJson("/api/v1/providers/{$p->slug}/reviews", reviewsPayload())->assertCreated();
    }
    $third = makeProvider();
    $this->actingAs($user)->postJson("/api/v1/providers/{$third->slug}/reviews", reviewsPayload())
        ->assertStatus(429)->assertHeader('Retry-After');
});

it('liste mes avis (auteur seulement, tous statuts, paginé)', function () {
    $user = User::factory()->create();
    $mine1 = Review::factory()->pending()->create(['user_id' => $user->id]);
    $mine2 = Review::factory()->rejected()->create(['user_id' => $user->id]);
    Review::factory()->create();

    $res = $this->actingAs($user)->getJson('/api/v1/me/reviews?per_page=1')->assertOk()
        ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.per_page', 1)->assertJsonCount(1, 'data');
    expect($res->json('data.0.id'))->toBe($mine2->id);
    $this->actingAs($user)->getJson('/api/v1/me/reviews?page=2')->assertOk();
    $all = $this->actingAs($user)->getJson('/api/v1/me/reviews')->json('data');
    expect(collect($all)->pluck('id')->all())->toBe([$mine2->id, $mine1->id]);
    expect($all[0]['rejection_reason'])->not->toBeNull();

    auth()->forgetGuards();
    $this->getJson('/api/v1/me/reviews')->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->getJson('/api/v1/me/reviews')->assertForbidden();
    $this->actingAs($user)->getJson('/api/v1/me/reviews?page=0')->assertUnprocessable();
});

it('modifier un avis publié le repasse en attente, le masque et recalcule la note', function () {
    $provider = makeProvider();
    $user = User::factory()->create();
    $review = Review::factory()->rating(5)->replied('Merci !')->create(['provider_id' => $provider->id, 'user_id' => $user->id]);
    $admin = makeAdmin();
    expect($provider->fresh()->rating_count)->toBe(1);

    $res = $this->actingAs($user)->patchJson("/api/v1/me/reviews/{$review->id}", ['rating' => 2, 'status' => 'approved', 'is_visible' => true])
        ->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.is_visible', false)
        ->assertJsonPath('data.rating', 2)->assertJsonPath('data.provider_reply', 'Merci !');

    $review->refresh();
    expect($review->moderated_by)->toBeNull()->and($review->moderated_at)->toBeNull()->and($review->rejection_reason)->toBeNull();
    expect($provider->fresh()->rating_count)->toBe(0)->and((float) $provider->fresh()->rating_avg)->toBe(0.0);
    $this->getJson("/api/v1/providers/{$provider->slug}/reviews")->assertJsonCount(0, 'data');
    Notification::assertSentTo($admin, AdminAlert::class);
});

it('un avis rejeté peut être corrigé puis resoumis', function () {
    $user = User::factory()->create();
    $review = Review::factory()->rejected()->create(['user_id' => $user->id]);

    $this->actingAs($user)->patchJson("/api/v1/me/reviews/{$review->id}", ['body' => 'Version corrigée de mon avis, plus factuelle.'])
        ->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.rejection_reason', null);
});

it('valide et protège la modification (422, 401, 403, 404 pour autrui)', function () {
    $user = User::factory()->create();
    $review = Review::factory()->create(['user_id' => $user->id]);
    $url = "/api/v1/me/reviews/{$review->id}";

    $this->actingAs($user)->patchJson($url, [])->assertUnprocessable();
    $this->actingAs($user)->patchJson($url, ['rating' => 0])->assertUnprocessable();
    $this->actingAs($user)->patchJson($url, ['body' => 'court'])->assertUnprocessable();
    auth()->forgetGuards();
    $this->patchJson($url, ['rating' => 3])->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->patchJson($url, ['rating' => 3])->assertForbidden();
    $this->actingAs(User::factory()->create())->patchJson($url, ['rating' => 3])->assertNotFound();
    $this->actingAs(makeAdmin())->patchJson($url, ['rating' => 3])->assertNotFound();
    $this->actingAs($user)->patchJson('/api/v1/me/reviews/999999', ['rating' => 3])->assertNotFound();
    expect($review->fresh()->status)->toBe('approved');
});

it('supprime logiquement mon avis et recalcule la note moyenne', function () {
    $provider = makeProvider();
    $user = User::factory()->create();
    $review = Review::factory()->rating(4)->create(['provider_id' => $provider->id, 'user_id' => $user->id]);
    expect($provider->fresh()->rating_count)->toBe(1);
    $url = "/api/v1/me/reviews/{$review->id}";

    $this->deleteJson($url)->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->deleteJson($url)->assertForbidden();
    $this->actingAs(User::factory()->create())->deleteJson($url)->assertNotFound();
    expect($review->fresh())->not->toBeNull();

    $this->actingAs($user)->deleteJson($url)->assertNoContent();
    expect(Review::find($review->id))->toBeNull()->and(Review::withTrashed()->find($review->id))->not->toBeNull();
    expect($provider->fresh()->rating_count)->toBe(0);
    $this->actingAs($user)->deleteJson($url)->assertNotFound();
    expect(AuditLog::count())->toBe(0);
});
