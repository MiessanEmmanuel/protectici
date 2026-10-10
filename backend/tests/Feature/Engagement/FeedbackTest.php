<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\ConsentLog;
use App\Models\Feedback;
use App\Models\FeedbackReply;
use App\Models\FeedbackTopic;
use App\Models\IdempotencyKey;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Feedback\FeedbackMail;
use App\Services\Turnstile\TurnstileVerifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

const FEEDBACKS_URL = '/api/v1/feedbacks';
const FEEDBACK_TRACK_URL = '/api/v1/feedbacks/track';

beforeEach(function () {
    Notification::fake();
    RateLimiter::clear('x');
});

function feedbackPayload(array $overrides = []): array
{
    return array_merge([
        'civility' => 'M.',
        'last_name' => 'Kouassi',
        'first_name' => 'Aya',
        'email' => 'aya.kouassi@exemple.test',
        'phone' => '07 09 44 51 11',
        'action_type' => 'complaint',
        'target_type' => 'service',
        'service_type_id' => ServiceType::factory()->create(['is_visible' => true])->id,
        'topic_id' => FeedbackTopic::factory()->create(['is_visible' => true])->id,
        'comment' => 'L\'agent est arrivé en retard à deux reprises ce mois-ci.',
        'consent' => true,
    ], $overrides);
}

/** Dossier « Dis-moi tout » inséré directement (le modèle n'a pas de factory). */
function makeFeedback(array $attributes = []): Feedback
{
    $feedback = new Feedback;
    $feedback->forceFill($attributes + [
        'last_name' => 'Traoré', 'first_name' => 'Awa', 'email' => 'awa.traore@exemple.test',
        'action_type' => 'question', 'target_type' => 'product',
        'comment' => 'Quelle est la durée d\'une formation de base ?', 'consent_at' => now(),
    ])->save();

    return $feedback->refresh();
}

it('enregistre un dossier public avec référence DMT, consentement tracé, accusé en file et alerte admin', function () {
    makeAdmin();
    $provider = makeProvider();

    $response = $this->postJson(FEEDBACKS_URL, feedbackPayload(['provider_slug' => $provider->slug]))->assertCreated();

    expect($response->json('data.reference'))->toMatch('/^DMT-\d{4}-\d{6}$/')
        ->and($response->json('data.status'))->toBe('new')
        ->and($response->json('data.message'))->toContain('Conservez ce numéro de suivi');

    $feedback = Feedback::query()->firstOrFail();
    expect($feedback->reference)->toBe($response->json('data.reference'))
        ->and($feedback->user_id)->toBeNull()
        ->and($feedback->provider_id)->toBe($provider->id)
        ->and($feedback->status)->toBe('new')
        ->and($feedback->phone)->toBe('+2250709445111')
        ->and($feedback->ip_hash)->not->toBeNull()->and($feedback->ip_hash)->not->toContain('127.0.0.1');

    expect(ConsentLog::query()->where('purpose', 'feedback')->count())->toBe(1);
    Notification::assertSentOnDemand(FeedbackMail::class, fn (FeedbackMail $m, array $channels, $notifiable) => $notifiable->routes['mail'] === 'aya.kouassi@exemple.test' && $m->event === FeedbackMail::RECEIVED && $m instanceof ShouldQueue);
    Notification::assertSentTo(User::query()->where('role', 'admin')->get(), AdminAlert::class, fn (AdminAlert $a) => $a->kind === AdminAlert::KIND_FEEDBACK_RECEIVED && ! str_contains(json_encode($a->toArray(new stdClass)), 'exemple.test'));
});

it('rattache le dossier au compte connecté', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->postJson(FEEDBACKS_URL, feedbackPayload())->assertCreated();
    expect(Feedback::query()->firstOrFail()->user_id)->toBe($user->id);
});

it('applique les validations conditionnelles et la liste blanche', function () {
    $this->postJson(FEEDBACKS_URL, [])->assertUnprocessable()->assertJsonValidationErrors(['last_name', 'first_name', 'email', 'action_type', 'target_type', 'comment', 'consent']);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['target_type' => 'employee', 'topic_id' => null]))->assertUnprocessable()->assertJsonValidationErrors(['topic_id']);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['target_type' => 'service', 'service_type_id' => null]))->assertUnprocessable()->assertJsonValidationErrors(['service_type_id']);
    // Produit : ni sujet ni type de prestation requis.
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['target_type' => 'product', 'topic_id' => null, 'service_type_id' => null, 'product_type' => 'Caméra']))->assertCreated();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['comment' => 'court']))->assertUnprocessable()->assertJsonValidationErrors(['comment']);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['consent' => false]))->assertUnprocessable()->assertJsonValidationErrors(['consent']);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['provider_slug' => 'inconnu']))->assertUnprocessable()->assertJsonValidationErrors(['provider_slug']);

    $hidden = Provider::factory()->pending()->create(['city_id' => City::factory()->create()->id]);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['provider_slug' => $hidden->slug]))->assertUnprocessable();

    // status / user_id / reference fournis par le client sont ignorés.
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['status' => 'closed', 'user_id' => 999, 'reference' => 'DMT-2020-000001']))->assertCreated();
    $last = Feedback::query()->latest('id')->firstOrFail();
    expect($last->status)->toBe('new')->and($last->user_id)->toBeNull()->and($last->reference)->not->toBe('DMT-2020-000001');
});

it('nettoie le texte libre (aucun HTML conservé)', function () {
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['comment' => '<script>alert(1)</script>Ceci est un long commentaire <b>gras</b>.']))->assertCreated();
    expect(Feedback::query()->firstOrFail()->comment)->not->toContain('<')->and(Feedback::query()->firstOrFail()->comment)->toContain('Ceci est un long commentaire');
});

it('champ piège rempli : succès simulé identique, rien enregistré ni envoyé', function () {
    $response = $this->postJson(FEEDBACKS_URL, feedbackPayload(['company_website' => 'http://spam.example']))->assertCreated();

    expect($response->json('data.reference'))->toMatch('/^DMT-\d{4}-\d{6}$/')->and($response->json('data.status'))->toBe('new')
        ->and(array_keys($response->json('data')))->toBe(['reference', 'status', 'message']);
    expect(Feedback::query()->count())->toBe(0)->and(ConsentLog::query()->count())->toBe(0)->and(IdempotencyKey::query()->count())->toBe(0);
    Notification::assertNothingSent();
});

it('idempotence : deux envois avec la même clé = un dossier et un e-mail', function () {
    $payload = feedbackPayload();
    $first = $this->withHeaders(['Idempotency-Key' => 'cle-feedback-0001'])->postJson(FEEDBACKS_URL, $payload)->assertCreated();
    $second = $this->withHeaders(['Idempotency-Key' => 'cle-feedback-0001'])->postJson(FEEDBACKS_URL, $payload)->assertCreated();

    expect($second->json('data.reference'))->toBe($first->json('data.reference'))
        ->and(Feedback::query()->count())->toBe(1)->and(ConsentLog::query()->count())->toBe(1);
    Notification::assertSentOnDemandTimes(FeedbackMail::class, 1);

    $this->withHeaders(['Idempotency-Key' => 'cle-feedback-0001'])->postJson(FEEDBACKS_URL, feedbackPayload(['comment' => 'Un tout autre commentaire pour la même clé.']))->assertUnprocessable()->assertJsonValidationErrors(['idempotency_key']);
    $this->withHeaders(['Idempotency-Key' => 'x'])->postJson(FEEDBACKS_URL, $payload)->assertUnprocessable();
});

it('limite à 5 / heure / IP et 10 / jour / e-mail (429 + Retry-After), sans compter les rejets de validation', function () {
    config(['public_forms.limits.feedback.ip_per_hour' => 2]);
    $this->postJson(FEEDBACKS_URL, [])->assertUnprocessable();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['email' => 'a@exemple.test']))->assertCreated();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['email' => 'b@exemple.test']))->assertCreated();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['email' => 'c@exemple.test']))->assertStatus(429)->assertHeader('Retry-After');
    expect(Feedback::query()->count())->toBe(2);

    RateLimiter::clear('form-ip|feedback|'.sha1('127.0.0.1'));
    config(['public_forms.limits.feedback.ip_per_hour' => 50, 'public_forms.limits.feedback.email_per_day' => 1]);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['email' => 'D@exemple.test']))->assertCreated();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['email' => 'd@exemple.test']))->assertStatus(429);
});

it('exige Turnstile quand il est activé', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'secret-test']);
    $this->app->bind(TurnstileVerifier::class, fn () => new class implements TurnstileVerifier
    {
        public function enabled(): bool
        {
            return true;
        }

        public function verify(string $token, ?string $ip = null): bool
        {
            return $token === 'bon-jeton';
        }
    });

    $this->postJson(FEEDBACKS_URL, feedbackPayload())->assertUnprocessable()->assertJsonValidationErrors(['turnstile_token']);
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['turnstile_token' => 'mauvais']))->assertUnprocessable();
    $this->postJson(FEEDBACKS_URL, feedbackPayload(['turnstile_token' => 'bon-jeton']))->assertCreated();
});

it('suivi : référence + e-mail (casse ignorée), réponses non internes seulement, aucune coordonnée', function () {
    $feedback = makeFeedback();
    $admin = makeAdmin();
    foreach ([['Réponse publique de l\'équipe.', false], ['Note interne confidentielle.', true]] as [$body, $internal]) {
        (new FeedbackReply)->fill(['feedback_id' => $feedback->id, 'body' => $body, 'is_internal' => $internal])->forceFill(['user_id' => $admin->id])->save();
    }

    $response = $this->postJson(FEEDBACK_TRACK_URL, ['reference' => strtolower($feedback->reference), 'email' => 'AWA.TRAORE@exemple.test'])->assertOk();

    expect($response->json('data.reference'))->toBe($feedback->reference)
        ->and($response->json('data.status'))->toBe('new')
        ->and($response->json('data.replies'))->toHaveCount(1)
        ->and($response->json('data.replies.0.body'))->toBe('Réponse publique de l\'équipe.');
    expect($response->getContent())->not->toContain('Note interne')->not->toContain('awa.traore')->not->toContain('Traoré');
});

it('suivi : 404 générique identique (référence inconnue ou e-mail faux), jamais via GET', function () {
    $feedback = makeFeedback();

    $unknown = $this->postJson(FEEDBACK_TRACK_URL, ['reference' => 'DMT-2099-999999', 'email' => 'awa.traore@exemple.test'])->assertNotFound();
    $wrongEmail = $this->postJson(FEEDBACK_TRACK_URL, ['reference' => $feedback->reference, 'email' => 'autre@exemple.test'])->assertNotFound();

    expect($unknown->json())->toBe($wrongEmail->json())->and($unknown->json('message'))->toBe('Aucun dossier ne correspond à ces informations.');
    $this->getJson(FEEDBACK_TRACK_URL.'?reference='.$feedback->reference.'&email=awa.traore@exemple.test')->assertStatus(405);
    $this->postJson(FEEDBACK_TRACK_URL, ['reference' => 'pas-une-ref', 'email' => 'x'])->assertUnprocessable();
    $this->postJson(FEEDBACK_TRACK_URL, [])->assertUnprocessable();
});

it('suivi : 10 / heure / IP et 5 / heure / référence (429)', function () {
    $feedback = makeFeedback();
    $body = ['reference' => $feedback->reference, 'email' => 'faux@exemple.test'];
    foreach (range(1, 5) as $i) {
        $this->postJson(FEEDBACK_TRACK_URL, $body)->assertNotFound();
    }
    $this->postJson(FEEDBACK_TRACK_URL, $body)->assertStatus(429)->assertHeader('Retry-After');
    // Une autre référence n'est pas touchée par le plafond de la première.
    $this->postJson(FEEDBACK_TRACK_URL, ['reference' => 'DMT-2099-000001', 'email' => 'faux@exemple.test'])->assertNotFound();

    RateLimiter::clear('feedback-track-ref:'.sha1($feedback->reference));
    config(['public_forms.track_per_hour_per_ip' => 8]);
    $this->postJson(FEEDBACK_TRACK_URL, $body)->assertStatus(429);
});

// --- Administration ---------------------------------------------------------------------------------------

it('protège toutes les routes admin des dossiers', function () {
    $routes = [['get', '/api/v1/admin/feedbacks'], ['get', '/api/v1/admin/feedbacks/1'], ['patch', '/api/v1/admin/feedbacks/1'], ['post', '/api/v1/admin/feedbacks/1/replies']];
    foreach ($routes as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach ($routes as [$method, $url]) {
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $actor) {
            $this->actingAs($actor)->{$method.'Json'}($url)->assertForbidden();
        }
    }
});

it('liste, filtre et affiche les dossiers (admin)', function () {
    $admin = makeAdmin();
    $provider = makeProvider(['name' => 'Alpha Garde']);
    $a = makeFeedback(['provider_id' => $provider->id, 'action_type' => 'complaint', 'status' => 'in_progress', 'assigned_to' => $admin->id]);
    makeFeedback(['last_name' => 'Zongo', 'email' => 'zongo@exemple.test']);

    $all = $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks')->assertOk();
    expect($all->json('meta.total'))->toBe(2)->and($all->json('data.0'))->toHaveKeys(['id', 'reference', 'author', 'provider', 'action_type', 'target_type', 'status', 'assigned_to', 'created_at']);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?status=in_progress')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?action_type=complaint')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?provider='.$provider->slug)->json('data.0.reference'))->toBe($a->reference);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?assigned_to='.$admin->id)->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?q=zongo')->json('meta.total'))->toBe(1);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?q='.strtolower($a->reference))->json('meta.total'))->toBe(1);
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks?status=bidon')->assertUnprocessable();

    $detail = $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/'.$a->id)->assertOk();
    expect($detail->json('data'))->toHaveKeys(['civility', 'phone', 'service_type', 'topic', 'product_type', 'location', 'comment', 'consent_at', 'resolved_at', 'replies'])
        ->and($detail->json('data.provider.name'))->toBe('Alpha Garde')
        ->and($detail->json('data.assigned_to.id'))->toBe($admin->id);
    $this->actingAs($admin)->getJson('/api/v1/admin/feedbacks/999999')->assertNotFound();
});

it('met à jour statut et affectation, pose resolved_at et audite', function () {
    $admin = makeAdmin();
    $feedback = makeFeedback();

    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['status' => 'resolved', 'assigned_to' => $admin->id])
        ->assertOk()->assertJsonPath('data.status', 'resolved')->assertJsonPath('data.assigned_to.id', $admin->id);
    $feedback->refresh();
    expect($feedback->resolved_at)->not->toBeNull();
    $first = $feedback->resolved_at;
    expect(AuditLog::query()->whereIn('event', ['feedback_status_changed', 'feedback_assigned'])->count())->toBe(2);

    // Rejouer ne change rien et n'audite pas à nouveau.
    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['status' => 'resolved'])->assertOk();
    expect(AuditLog::query()->where('event', 'feedback_status_changed')->count())->toBe(1)->and($feedback->refresh()->resolved_at->equalTo($first))->toBeTrue();

    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['status' => 'in_progress', 'assigned_to' => null])->assertOk();
    expect($feedback->refresh()->resolved_at)->toBeNull()->and($feedback->assigned_to)->toBeNull();

    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, [])->assertUnprocessable();
    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['status' => 'bidon'])->assertUnprocessable();
    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['assigned_to' => User::factory()->create()->id])->assertUnprocessable(); // pas un admin
    $this->actingAs($admin)->patchJson('/api/v1/admin/feedbacks/'.$feedback->id, ['status' => 'closed', 'reference' => 'X'])->assertOk();
    expect($feedback->refresh()->reference)->toStartWith('DMT-');
});

it('réponse interne = note ; réponse externe = e-mail envoyé une seule fois', function () {
    $admin = makeAdmin();
    $feedback = makeFeedback();
    $url = '/api/v1/admin/feedbacks/'.$feedback->id.'/replies';

    $this->actingAs($admin)->postJson($url, ['body' => 'Note interne.', 'is_internal' => true])->assertCreated()->assertJsonPath('data.is_internal', true)->assertJsonPath('data.sent_at', null);
    Notification::assertNothingSentTo(Notification::route('mail', 'awa.traore@exemple.test'));
    Notification::assertSentOnDemandTimes(FeedbackMail::class, 0);

    $first = $this->actingAs($admin)->postJson($url, ['body' => 'Bonjour, voici notre réponse.', 'is_internal' => false])->assertCreated();
    expect($first->json('data.sent_at'))->not->toBeNull()->and($first->json('data.author.id'))->toBe($admin->id);
    // Double soumission immédiate : même réponse, pas de second e-mail.
    $second = $this->actingAs($admin)->postJson($url, ['body' => 'Bonjour, voici notre réponse.', 'is_internal' => false])->assertCreated();
    expect($second->json('data.id'))->toBe($first->json('data.id'))->and(FeedbackReply::query()->count())->toBe(2);
    Notification::assertSentOnDemandTimes(FeedbackMail::class, 1);

    $this->actingAs($admin)->postJson($url, ['body' => 'abc', 'is_internal' => false])->assertUnprocessable();
    $this->actingAs($admin)->postJson($url, ['body' => 'Corps valide.'])->assertUnprocessable()->assertJsonValidationErrors(['is_internal']);
    $this->actingAs($admin)->postJson('/api/v1/admin/feedbacks/999999/replies', ['body' => 'Corps valide.', 'is_internal' => true])->assertNotFound();
});

it('refuse une réponse externe sur un dossier anonymisé', function () {
    $admin = makeAdmin();
    $feedback = makeFeedback();
    Feedback::query()->whereKey($feedback->id)->update(['email' => null]);

    $this->actingAs($admin)->postJson('/api/v1/admin/feedbacks/'.$feedback->id.'/replies', ['body' => 'Corps valide.', 'is_internal' => false])->assertStatus(409);
    $this->actingAs($admin)->postJson('/api/v1/admin/feedbacks/'.$feedback->id.'/replies', ['body' => 'Corps valide.', 'is_internal' => true])->assertCreated();
});
