<?php

use App\Models\AuditLog;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\User;
use App\Notifications\Reviews\ReviewMail;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
});

const REVIEW_ADMIN_ROUTES = [
    ['get', '/api/v1/admin/reviews'],
    ['post', '/api/v1/admin/reviews/1/approve'],
    ['post', '/api/v1/admin/reviews/1/reject'],
    ['delete', '/api/v1/admin/reviews/1'],
    ['get', '/api/v1/admin/review-reports'],
    ['post', '/api/v1/admin/review-reports/1/accept'],
    ['post', '/api/v1/admin/review-reports/1/dismiss'],
];

it('protège TOUTES les routes admin d\'avis : anonyme 401, user/provider/editor/admin sans 2FA 403', function () {
    $noTwoFactor = User::factory()->admin()->create();

    foreach (REVIEW_ADMIN_ROUTES as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach (REVIEW_ADMIN_ROUTES as [$method, $url]) {
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor()] as $actor) {
            $this->actingAs($actor)->{$method.'Json'}($url)->assertForbidden();
        }
        $this->actingAs($noTwoFactor)->{$method.'Json'}($url)->assertForbidden();
    }
});

it('liste les avis (pending par défaut) avec filtres, recherche et reports_count', function () {
    $admin = makeAdmin();
    $provider = makeProvider(['slug' => 'alpha-garde']);
    $author = User::factory()->create(['email' => 'auteur.special@example.test']);
    $pending = Review::factory()->pending()->create(['provider_id' => $provider->id, 'user_id' => $author->id, 'body' => 'Un texte avec 100% de satisfaction']);
    Review::factory()->pending()->create();
    Review::factory()->create();
    (new ReviewReport)->fill(['review_id' => $pending->id, 'reason' => 'spam'])->forceFill(['user_id' => User::factory()->create()->id])->save();

    $res = $this->actingAs($admin)->getJson('/api/v1/admin/reviews')->assertOk();
    expect($res->json('meta.total'))->toBe(2);
    $row = collect($res->json('data'))->firstWhere('id', $pending->id);
    expect($row)->toHaveKeys(['id', 'provider', 'author', 'rating', 'title', 'body', 'status', 'is_visible', 'reports_count', 'created_at'])
        ->and($row['reports_count'])->toBe(1)->and($row['author']['email'])->toBe('auteur.special@example.test')
        ->and($row['provider']['slug'])->toBe('alpha-garde');

    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?status=approved')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?provider=alpha-garde')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?q=auteur.special')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?q=100%25')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?q=%25')->json('meta.total'))->toBe(1); // le joker est échappé
    expect($this->actingAs($admin)->getJson('/api/v1/admin/reviews?per_page=1')->json('data'))->toHaveCount(1);
    $this->actingAs($admin)->getJson('/api/v1/admin/reviews?status=bidon')->assertUnprocessable();
});

it('approuve : publie, recalcule la note, audite, envoie UN e-mail, idempotent', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $author = User::factory()->create();
    $review = Review::factory()->pending()->rating(4)->create(['provider_id' => $provider->id, 'user_id' => $author->id]);
    $url = "/api/v1/admin/reviews/{$review->id}/approve";

    $this->actingAs($admin)->postJson($url)->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.is_visible', true);
    $this->actingAs($admin)->postJson($url)->assertOk();

    $review->refresh();
    expect($review->moderated_by)->toBe($admin->id)->and($review->moderated_at)->not->toBeNull()->and($review->rejection_reason)->toBeNull();
    expect($provider->fresh()->rating_count)->toBe(1)->and((float) $provider->fresh()->rating_avg)->toBe(4.0);
    expect(AuditLog::where('event', 'review_approved')->where('auditable_type', 'review')->where('auditable_id', $review->id)->count())->toBe(1);
    Notification::assertSentToTimes($author, ReviewMail::class, 1);
    $this->getJson("/api/v1/providers/{$provider->slug}/reviews")->assertJsonCount(1, 'data');
    $this->actingAs($admin)->postJson('/api/v1/admin/reviews/999999/approve')->assertNotFound();
});

it('rejette avec motif : masque, recalcule la note, audite, envoie UN e-mail, idempotent', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $author = User::factory()->create();
    $review = Review::factory()->rating(5)->create(['provider_id' => $provider->id, 'user_id' => $author->id]);
    expect($provider->fresh()->rating_count)->toBe(1);
    $url = "/api/v1/admin/reviews/{$review->id}/reject";

    $this->actingAs($admin)->postJson($url, [])->assertUnprocessable();
    $this->actingAs($admin)->postJson($url, ['reason' => 'court'])->assertUnprocessable();

    $this->actingAs($admin)->postJson($url, ['reason' => 'Propos injurieux envers le prestataire.'])->assertOk()
        ->assertJsonPath('data.status', 'rejected')->assertJsonPath('data.is_visible', false);
    $this->actingAs($admin)->postJson($url, ['reason' => 'Propos injurieux envers le prestataire.'])->assertOk();

    expect($review->fresh()->rejection_reason)->toBe('Propos injurieux envers le prestataire.');
    expect($provider->fresh()->rating_count)->toBe(0);
    expect(AuditLog::where('event', 'review_rejected')->count())->toBe(1);
    Notification::assertSentToTimes($author, ReviewMail::class, 1);
    Notification::assertSentTo($author, ReviewMail::class, fn ($n) => $n->event === 'rejected');
    $this->getJson("/api/v1/providers/{$provider->slug}/reviews")->assertJsonCount(0, 'data');
    $this->actingAs(User::factory()->create())->getJson('/api/v1/me/reviews')->assertOk();
});

it('un avis en attente ou rejeté n\'apparaît jamais dans l\'endpoint public', function () {
    $provider = makeProvider();
    Review::factory()->pending()->create(['provider_id' => $provider->id]);
    Review::factory()->rejected()->create(['provider_id' => $provider->id]);
    $ok = Review::factory()->create(['provider_id' => $provider->id]);

    $ids = collect($this->getJson("/api/v1/providers/{$provider->slug}/reviews")->assertOk()->json('data'))->pluck('id')->all();
    expect($ids)->toBe([$ok->id]);
});

it('supprime logiquement un avis, recalcule la note et audite', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $review = Review::factory()->create(['provider_id' => $provider->id]);
    expect($provider->fresh()->rating_count)->toBe(1);

    $this->actingAs($admin)->deleteJson("/api/v1/admin/reviews/{$review->id}")->assertNoContent();
    expect(Review::find($review->id))->toBeNull()->and(Review::withTrashed()->find($review->id))->not->toBeNull();
    expect($provider->fresh()->rating_count)->toBe(0);
    expect(AuditLog::where('event', 'review_deleted')->count())->toBe(1);
    $this->actingAs($admin)->deleteJson('/api/v1/admin/reviews/999999')->assertNotFound();
});

function reviewsReportOn(Review $review, ?User $by = null): ReviewReport
{
    $report = (new ReviewReport)->fill(['review_id' => $review->id, 'reason' => 'spam', 'details' => 'Détails']);
    $report->forceFill(['user_id' => ($by ?? User::factory()->create())->id, 'status' => 'open'])->save();

    return $report;
}

it('liste les signalements (open par défaut) au format du contrat', function () {
    $admin = makeAdmin();
    $reporter = User::factory()->create(['first_name' => 'Awa', 'last_name' => 'Koné']);
    $review = Review::factory()->create(['body' => str_repeat('mot ', 100)]);
    $open = reviewsReportOn($review, $reporter);
    $done = reviewsReportOn(Review::factory()->create());
    $done->forceFill(['status' => 'dismissed'])->save();

    $res = $this->actingAs($admin)->getJson('/api/v1/admin/review-reports')->assertOk();
    expect($res->json('meta.total'))->toBe(1);
    $row = $res->json('data.0');
    expect($row['id'])->toBe($open->id)->and($row)->toHaveKeys(['id', 'review', 'reporter', 'reason', 'details', 'status', 'created_at'])
        ->and($row['review'])->toHaveKeys(['id', 'rating', 'body_excerpt', 'provider_name'])
        ->and(mb_strlen($row['review']['body_excerpt']))->toBeLessThanOrEqual(141)
        ->and($row['reporter'])->toBe(['id' => $reporter->id, 'name' => 'Awa Koné']);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/review-reports?status=dismissed')->json('meta.total'))->toBe(1);
    $this->actingAs($admin)->getJson('/api/v1/admin/review-reports?status=bidon')->assertUnprocessable();
});

it('accepte un signalement : masque l\'avis, clôt les autres signalements, idempotent', function () {
    $admin = makeAdmin();
    $provider = makeProvider();
    $review = Review::factory()->create(['provider_id' => $provider->id]);
    $a = reviewsReportOn($review);
    $b = reviewsReportOn($review);
    expect($provider->fresh()->rating_count)->toBe(1);

    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$a->id}/accept")->assertOk()->assertJsonPath('data.status', 'accepted');
    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$a->id}/accept")->assertOk();

    $review->refresh();
    expect($review->is_visible)->toBeFalse()->and($review->status)->toBe('rejected')->and($review->rejection_reason)->toBe('Avis masqué suite à un signalement.')
        ->and($review->moderated_by)->toBe($admin->id);
    expect($b->fresh()->status)->toBe('accepted')->and($b->fresh()->handled_by)->toBe($admin->id);
    expect($provider->fresh()->rating_count)->toBe(0);
    expect(AuditLog::where('event', 'review_report_accepted')->count())->toBe(1);
    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$a->id}/dismiss")->assertStatus(409);
    $this->actingAs($admin)->postJson('/api/v1/admin/review-reports/999999/accept')->assertNotFound();
});

it('écarte un signalement : l\'avis reste publié, idempotent, 409 si déjà accepté', function () {
    $admin = makeAdmin();
    $review = Review::factory()->create();
    $a = reviewsReportOn($review);
    $accepted = reviewsReportOn(Review::factory()->create());
    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$accepted->id}/accept")->assertOk();

    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$a->id}/dismiss")->assertOk()->assertJsonPath('data.status', 'dismissed');
    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$a->id}/dismiss")->assertOk();
    expect($review->fresh()->is_visible)->toBeTrue();
    expect(AuditLog::where('event', 'review_report_dismissed')->count())->toBe(1);
    $this->actingAs($admin)->postJson("/api/v1/admin/review-reports/{$accepted->id}/dismiss")->assertStatus(409);
    $this->actingAs($admin)->postJson('/api/v1/admin/review-reports/999999/dismiss')->assertNotFound();
});
