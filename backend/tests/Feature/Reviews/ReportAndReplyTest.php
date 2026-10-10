<?php

use App\Models\Provider;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Reviews\ReviewMail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
});

it('signale un avis publié : 204, idempotent, une seule ligne et une seule alerte', function () {
    $admin = makeAdmin();
    $review = Review::factory()->create();
    $user = User::factory()->create();
    $url = "/api/v1/reviews/{$review->id}/report";

    $this->actingAs($user)->postJson($url, ['reason' => 'spam', 'details' => '<i>Publicité</i>'])->assertNoContent();
    $this->actingAs($user)->postJson($url, ['reason' => 'offensive'])->assertNoContent();

    expect(ReviewReport::where('review_id', $review->id)->count())->toBe(1);
    $report = ReviewReport::first();
    expect($report->reason)->toBe('spam')->and($report->details)->toBe('Publicité')->and($report->status)->toBe('open')->and($report->user_id)->toBe($user->id);
    Notification::assertSentToTimes($admin, AdminAlert::class, 1);
    Notification::assertSentTo($admin, AdminAlert::class, fn ($n) => $n->kind === 'review_reported' && $n->subject === ['type' => 'review', 'id' => $review->id]);

    // Un 2e utilisateur peut signaler : nouvelle ligne, pas de nouvelle alerte tant qu'un signalement est ouvert.
    $this->actingAs(User::factory()->create())->postJson($url, ['reason' => 'other'])->assertNoContent();
    expect(ReviewReport::count())->toBe(2);
    Notification::assertSentToTimes($admin, AdminAlert::class, 1);
});

it('valide et protège le signalement : 422, 401, 403, 404', function () {
    $review = Review::factory()->create();
    $url = "/api/v1/reviews/{$review->id}/report";
    $user = User::factory()->create();

    $this->actingAs($user)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
    $this->actingAs($user)->postJson($url, ['reason' => 'bidon'])->assertUnprocessable();
    $this->actingAs($user)->postJson($url, ['reason' => 'spam', 'details' => str_repeat('a', 1001)])->assertUnprocessable();
    auth()->forgetGuards();
    $this->postJson($url, ['reason' => 'spam'])->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->postJson($url, ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($review->user)->postJson($url, ['reason' => 'spam'])->assertForbidden();

    $pending = Review::factory()->pending()->create();
    $this->actingAs($user)->postJson("/api/v1/reviews/{$pending->id}/report", ['reason' => 'spam'])->assertNotFound();
    $this->actingAs($user)->postJson('/api/v1/reviews/999999/report', ['reason' => 'spam'])->assertNotFound();
    $deleted = Review::factory()->create();
    $deleted->delete();
    $this->actingAs($user)->postJson("/api/v1/reviews/{$deleted->id}/report", ['reason' => 'spam'])->assertNotFound();
    expect(ReviewReport::count())->toBe(0);
});

function reviewsOwnerWithProvider(): array
{
    $owner = User::factory()->provider()->create();
    $provider = makeProvider(['user_id' => $owner->id]);

    return [$owner, $provider];
}

it('liste les avis publiés de ma fiche (jamais les non publiés, même avec status)', function () {
    [$owner, $provider] = reviewsOwnerWithProvider();
    $published = Review::factory()->replied('Merci !')->create(['provider_id' => $provider->id]);
    $pending = Review::factory()->pending()->create(['provider_id' => $provider->id]);
    $rejected = Review::factory()->rejected()->create(['provider_id' => $provider->id]);
    Review::factory()->create(); // autre fiche
    $base = "/api/v1/me/establishments/provider/{$provider->slug}/reviews";

    $res = $this->actingAs($owner)->getJson($base)->assertOk();
    expect($res->json('data'))->toHaveCount(1)->and($res->json('data.0'))->toHaveKeys(['id', 'rating', 'title', 'body', 'author', 'status', 'created_at', 'provider_reply', 'provider_replied_at']);
    expect($res->json('data.0.id'))->toBe($published->id)->and($res->json('data.0'))->not->toHaveKey('email');
    expect($this->actingAs($owner)->getJson("{$base}?status=pending")->json('meta.total'))->toBe(0);
    expect($this->actingAs($owner)->getJson("{$base}?status=rejected")->json('meta.total'))->toBe(0);
    expect($this->actingAs($owner)->getJson("{$base}?status=approved")->json('meta.total'))->toBe(1);
    $this->actingAs($owner)->getJson("{$base}?status=bidon")->assertUnprocessable();
    expect($pending->id)->not->toBe($rejected->id);
});

it('protège la liste des avis de la fiche : 401, 403 non vérifié, 404 pour un non-propriétaire', function () {
    [$owner, $provider] = reviewsOwnerWithProvider();
    $base = "/api/v1/me/establishments/provider/{$provider->slug}/reviews";

    $this->getJson($base)->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->getJson($base)->assertForbidden();
    $this->actingAs(User::factory()->create())->getJson($base)->assertNotFound();
    $this->actingAs(makeAdmin())->getJson($base)->assertNotFound();
    $this->actingAs($owner)->getJson('/api/v1/me/establishments/provider/inconnu/reviews')->assertNotFound();
});

it('répond une seule fois à un avis publié et prévient l\'auteur par e-mail', function () {
    [$owner, $provider] = reviewsOwnerWithProvider();
    $author = User::factory()->create();
    $review = Review::factory()->create(['provider_id' => $provider->id, 'user_id' => $author->id]);
    $url = "/api/v1/me/establishments/provider/{$provider->slug}/reviews/{$review->id}/reply";

    $this->actingAs($owner)->postJson($url, ['body' => '<b>Merci</b> pour votre confiance.'])->assertOk()
        ->assertJsonPath('data.id', $review->id)->assertJsonPath('data.provider_reply', 'Merci pour votre confiance.');

    $review->refresh();
    expect($review->provider_reply)->not->toBeNull()->and($review->provider_replied_at)->not->toBeNull()->and($review->provider_replied_by)->toBe($owner->id);
    Notification::assertSentToTimes($author, ReviewMail::class, 1);
    expect(new ReviewMail('replied', 'X', 'x', 'y'))->toBeInstanceOf(ShouldQueue::class);

    $this->actingAs($owner)->postJson($url, ['body' => 'Seconde réponse.'])->assertStatus(409);
    Notification::assertSentToTimes($author, ReviewMail::class, 1);
    expect($review->fresh()->provider_reply)->toBe('Merci pour votre confiance.');
});

it('valide et protège la réponse : 422, 401, 403, 404 (autrui, non approuvé, autre fiche)', function () {
    [$owner, $provider] = reviewsOwnerWithProvider();
    $review = Review::factory()->create(['provider_id' => $provider->id]);
    $url = "/api/v1/me/establishments/provider/{$provider->slug}/reviews/{$review->id}/reply";
    $ok = ['body' => 'Merci pour votre retour.'];

    $this->actingAs($owner)->postJson($url, [])->assertUnprocessable();
    $this->actingAs($owner)->postJson($url, ['body' => 'abc'])->assertUnprocessable();
    $this->actingAs($owner)->postJson($url, ['body' => str_repeat('a', 1501)])->assertUnprocessable();
    auth()->forgetGuards();
    $this->postJson($url, $ok)->assertUnauthorized();
    $this->actingAs(User::factory()->unverified()->create())->postJson($url, $ok)->assertForbidden();
    $this->actingAs(User::factory()->create())->postJson($url, $ok)->assertNotFound();

    $pending = Review::factory()->pending()->create(['provider_id' => $provider->id]);
    $rejected = Review::factory()->rejected()->create(['provider_id' => $provider->id]);
    foreach ([$pending, $rejected] as $r) {
        $this->actingAs($owner)->postJson("/api/v1/me/establishments/provider/{$provider->slug}/reviews/{$r->id}/reply", $ok)->assertNotFound();
    }
    $other = Review::factory()->create();
    $this->actingAs($owner)->postJson("/api/v1/me/establishments/provider/{$provider->slug}/reviews/{$other->id}/reply", $ok)->assertNotFound();
    $deleted = Review::factory()->create(['provider_id' => $provider->id]);
    $deleted->delete();
    $this->actingAs($owner)->postJson("/api/v1/me/establishments/provider/{$provider->slug}/reviews/{$deleted->id}/reply", $ok)->assertNotFound();
    expect(Review::whereNotNull('provider_reply')->count())->toBe(0);
    Notification::assertNothingSent();
    expect(Provider::count())->toBeGreaterThan(1);
});
