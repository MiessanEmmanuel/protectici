<?php

use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Models\User;

const MY_FEEDBACK_KEYS = ['id', 'reference', 'status', 'action_type', 'target_type', 'provider', 'service_type', 'topic',
    'comment', 'has_voice', 'created_at', 'resolved_at', 'replies'];

/** Dossier rattaché au compte $user. */
function myFeedback(User $user, array $attributes = []): Feedback
{
    $feedback = Feedback::factory()->create($attributes);
    $feedback->forceFill(['user_id' => $user->id])->save();

    return $feedback->refresh();
}

function feedbackReply(Feedback $feedback, string $body, bool $internal): void
{
    (new FeedbackReply)->fill(['feedback_id' => $feedback->id, 'body' => $body, 'is_internal' => $internal])
        ->forceFill(['user_id' => User::factory()->admin()->create()->id])->save();
}

it('protège la liste : anonyme 401, e-mail non vérifié 403', function () {
    $feedback = myFeedback(User::factory()->create());
    $urls = ['/api/v1/me/feedbacks', "/api/v1/me/feedbacks/{$feedback->id}"];

    foreach ($urls as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach ($urls as $url) {
        $this->actingAs(User::factory()->unverified()->create())->getJson($url)->assertForbidden();
    }
});

it('liste uniquement les dossiers rattachés à son compte, avec filtre et pagination', function () {
    $me = User::factory()->create();
    $mine = myFeedback($me);
    $mine2 = myFeedback($me, ['status' => 'resolved']);
    $other = myFeedback(User::factory()->create(), ['email' => 'autre.client@example.com']);
    $anonymous = Feedback::factory()->create()->refresh();

    $res = $this->actingAs($me)->getJson('/api/v1/me/feedbacks')->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total'], 'links']);
    expect(collect($res->json('data'))->pluck('reference')->all())->toEqualCanonicalizing([$mine->reference, $mine2->reference])
        ->and($res->json('data.0'))->toHaveKeys(MY_FEEDBACK_KEYS)
        ->and($res->getContent())->not->toContain($other->reference)->not->toContain($anonymous->reference)
        ->not->toContain($mine->email);

    $this->actingAs($me)->getJson('/api/v1/me/feedbacks?status=resolved')->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $mine2->reference);
    $this->actingAs($me)->getJson('/api/v1/me/feedbacks?per_page=1')->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($me)->getJson('/api/v1/me/feedbacks?status=nimporte')->assertUnprocessable();
});

it('affiche le dossier avec les réponses envoyées, jamais les notes internes', function () {
    $me = User::factory()->create();
    $feedback = myFeedback($me);
    feedbackReply($feedback, 'Note interne confidentielle.', true);
    feedbackReply($feedback, 'Bonjour, nous avons contacté le prestataire.', false);

    $res = $this->actingAs($me)->getJson("/api/v1/me/feedbacks/{$feedback->id}")->assertOk()
        ->assertJsonPath('data.reference', $feedback->reference)
        ->assertJsonCount(1, 'data.replies')
        ->assertJsonPath('data.replies.0.body', 'Bonjour, nous avons contacté le prestataire.');
    expect($res->json('data'))->toHaveKeys(MY_FEEDBACK_KEYS)
        ->and($res->getContent())->not->toContain('Note interne confidentielle.');
});

it('renvoie 404 pour le dossier d\'un autre utilisateur ou envoyé sans compte', function () {
    $me = User::factory()->create();

    $this->actingAs($me)->getJson('/api/v1/me/feedbacks/'.myFeedback(User::factory()->create())->id)->assertNotFound();
    $this->actingAs($me)->getJson('/api/v1/me/feedbacks/'.Feedback::factory()->create()->id)->assertNotFound();
});
