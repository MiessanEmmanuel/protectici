<?php

use App\Jobs\SyncNewsletterContact;
use App\Models\AuditLog;
use App\Models\ConsentLog;
use App\Models\NewsletterSubscriber;
use App\Notifications\Newsletter\NewsletterMail;
use App\Services\Newsletter\NewsletterTokens;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

const NL = '/api/v1/newsletter';

function subscribePayload(array $overrides = []): array
{
    return array_merge(['email' => 'Lecteur@Exemple.test', 'consent' => true, 'source' => 'footer'], $overrides);
}

/** Jeton de confirmation tel qu'il figure dans l'e-mail envoyé. */
function sentConfirmToken(): string
{
    $url = null;
    Notification::assertSentOnDemand(NewsletterMail::class, function (NewsletterMail $mail) use (&$url) {
        $url = $mail->confirmUrl;

        return true;
    });
    parse_str((string) parse_url((string) $url, PHP_URL_QUERY), $query);

    return $query['token'];
}

it('répond 202 et envoie un e-mail de confirmation pour une nouvelle adresse', function () {
    Notification::fake();

    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);

    $subscriber = NewsletterSubscriber::firstOrFail();
    expect($subscriber->email)->toBe('lecteur@exemple.test')->and($subscriber->status)->toBe('pending')
        ->and($subscriber->confirmation_token_hash)->toHaveLength(64)->and($subscriber->ip_hash)->toHaveLength(64)
        ->and($subscriber->consent_at)->not->toBeNull();
    Notification::assertSentOnDemandTimes(NewsletterMail::class, 1);
    expect(ConsentLog::where('purpose', 'newsletter')->count())->toBe(1);
});

it('répond de façon strictement identique pour une adresse déjà confirmée, sans second e-mail', function () {
    Notification::fake();
    NewsletterSubscriber::forceCreate(['email' => 'connu@exemple.test', 'status' => 'confirmed', 'consent_at' => now(), 'confirmed_at' => now()]);

    $new = $this->postJson(NL.'/subscribe', subscribePayload(['email' => 'nouveau@exemple.test']));
    $known = $this->postJson(NL.'/subscribe', subscribePayload(['email' => 'connu@exemple.test']));

    expect($known->getStatusCode())->toBe($new->getStatusCode())->and($known->getContent())->toBe($new->getContent());
    Notification::assertSentOnDemandTimes(NewsletterMail::class, 1);
    expect(NewsletterSubscriber::where('email', 'connu@exemple.test')->value('status'))->toBe('confirmed');
});

it('applique le double opt-in : confirmation par lien signé, idempotente', function () {
    Notification::fake();
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);
    $token = sentConfirmToken();

    $this->getJson(NL.'/confirm?token='.$token)->assertOk()->assertExactJson(['data' => ['status' => 'confirmed']]);
    $this->getJson(NL.'/confirm?token='.$token)->assertOk();

    $subscriber = NewsletterSubscriber::firstOrFail();
    expect($subscriber->status)->toBe('confirmed')->and($subscriber->confirmed_at)->not->toBeNull()->and($subscriber->confirmation_token_hash)->toBeNull();
    expect(AuditLog::where('event', 'newsletter_confirmed')->count())->toBe(1);
});

it('refuse un lien de confirmation falsifié, expiré, ou d\'un autre type, avec un 422 générique', function () {
    Notification::fake();
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);
    $token = sentConfirmToken();
    $subscriber = NewsletterSubscriber::firstOrFail();

    $tampered = substr($token, 0, -1).(str_ends_with($token, '0') ? '1' : '0');
    $this->getJson(NL.'/confirm?token='.$tampered)->assertStatus(422)->assertJsonValidationErrors(['token']);
    $this->getJson(NL.'/confirm?token='.NewsletterTokens::make(NewsletterTokens::UNSUBSCRIBE, $subscriber->id))->assertStatus(422);
    $this->getJson(NL.'/confirm?token=nimporte-quoi')->assertStatus(422);
    $this->getJson(NL.'/confirm')->assertStatus(422);
    expect($subscriber->refresh()->status)->toBe('pending');

    $this->travel(25)->hours();
    $this->getJson(NL.'/confirm?token='.$token)->assertStatus(422)->assertJsonPath('errors.token.0', 'Ce lien est invalide ou a expiré.');
    expect($subscriber->refresh()->status)->toBe('pending');
});

it('invalide l\'ancien lien quand une nouvelle confirmation est demandée', function () {
    Notification::fake();
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);
    $first = sentConfirmToken();
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);

    $this->getJson(NL.'/confirm?token='.$first)->assertStatus(422);
    expect(NewsletterSubscriber::firstOrFail()->status)->toBe('pending');
});

it('désinscrit par lien signé, de façon idempotente, en ne gardant que la preuve', function () {
    Notification::fake();
    $subscriber = NewsletterSubscriber::forceCreate(['email' => 'abonne@exemple.test', 'status' => 'confirmed', 'source' => 'blog', 'consent_at' => now(), 'confirmed_at' => now(), 'ip_hash' => str_repeat('a', 64)]);
    $token = NewsletterTokens::make(NewsletterTokens::UNSUBSCRIBE, $subscriber->id);

    $this->postJson(NL.'/unsubscribe', ['token' => $token])->assertOk()->assertExactJson(['data' => ['status' => 'unsubscribed']]);
    $this->postJson(NL.'/unsubscribe', ['token' => $token])->assertOk();

    $subscriber->refresh();
    expect($subscriber->status)->toBe('unsubscribed')->and($subscriber->unsubscribed_at)->not->toBeNull()
        ->and($subscriber->ip_hash)->toBeNull()->and($subscriber->source)->toBeNull();
    expect(AuditLog::where('event', 'newsletter_unsubscribed')->count())->toBe(1);

    $this->postJson(NL.'/unsubscribe', ['token' => NewsletterTokens::make(NewsletterTokens::CONFIRM, $subscriber->id)])->assertStatus(422);
    $this->postJson(NL.'/unsubscribe', ['token' => 'faux.1.0.0000000000000000.'.str_repeat('0', 64)])->assertStatus(422);
    $this->postJson(NL.'/unsubscribe', [])->assertStatus(422)->assertJsonValidationErrors(['token']);
});

it('permet de se réabonner après une désinscription (nouvelle confirmation requise)', function () {
    Notification::fake();
    NewsletterSubscriber::forceCreate(['email' => 'retour@exemple.test', 'status' => 'unsubscribed', 'consent_at' => now(), 'unsubscribed_at' => now()]);

    $this->postJson(NL.'/subscribe', subscribePayload(['email' => 'retour@exemple.test']))->assertStatus(202);

    $subscriber = NewsletterSubscriber::firstOrFail();
    expect($subscriber->status)->toBe('pending')->and($subscriber->unsubscribed_at)->toBeNull();
    Notification::assertSentOnDemandTimes(NewsletterMail::class, 1);
});

it('valide l\'inscription', function (array $payload, string $field) {
    $this->postJson(NL.'/subscribe', $payload)->assertStatus(422)->assertJsonValidationErrors([$field]);
})->with([
    'sans e-mail' => [['consent' => true], 'email'],
    'e-mail invalide' => [['email' => 'pas-un-email', 'consent' => true], 'email'],
    'sans consentement' => [['email' => 'a@exemple.test'], 'consent'],
    'consentement refusé' => [['email' => 'a@exemple.test', 'consent' => false], 'consent'],
    'source inconnue' => [['email' => 'a@exemple.test', 'consent' => true, 'source' => 'piratage'], 'source'],
]);

it('simule le succès sans rien enregistrer ni envoyer quand le champ piège est rempli', function () {
    Notification::fake();

    $this->postJson(NL.'/subscribe', subscribePayload(['company_website' => 'https://spam.test']))->assertStatus(202);

    expect(NewsletterSubscriber::count())->toBe(0);
    Notification::assertNothingSent();
});

it('applique Idempotency-Key : deux envois identiques n\'envoient qu\'un e-mail', function () {
    Notification::fake();
    $headers = ['Idempotency-Key' => 'cle-newsletter-1'];

    $this->postJson(NL.'/subscribe', subscribePayload(), $headers)->assertStatus(202);
    $this->postJson(NL.'/subscribe', subscribePayload(), $headers)->assertStatus(202);

    Notification::assertSentOnDemandTimes(NewsletterMail::class, 1);
    expect(NewsletterSubscriber::count())->toBe(1);
});

it('limite les inscriptions à 5 par heure et par adresse IP', function () {
    Notification::fake();

    foreach (range(1, 5) as $i) {
        $this->postJson(NL.'/subscribe', subscribePayload(['email' => "lecteur{$i}@exemple.test"]))->assertStatus(202);
    }
    $this->postJson(NL.'/subscribe', subscribePayload(['email' => 'lecteur6@exemple.test']))->assertStatus(429)->assertHeader('Retry-After');
});

it('ne synchronise rien vers Resend quand le drapeau est désactivé', function () {
    Queue::fake();
    Notification::fake();
    config(['services.resend.newsletter_sync' => false, 'services.resend.key' => 're_test', 'services.resend.audience_id' => 'aud']);
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);

    $this->getJson(NL.'/confirm?token='.sentConfirmToken())->assertOk();

    Queue::assertNotPushed(SyncNewsletterContact::class);
});

it('met en file la synchronisation Resend à la confirmation quand le drapeau est actif', function () {
    Queue::fake();
    Notification::fake();
    config(['services.resend.newsletter_sync' => true, 'services.resend.key' => 're_test', 'services.resend.audience_id' => 'aud']);
    $this->postJson(NL.'/subscribe', subscribePayload())->assertStatus(202);

    $this->getJson(NL.'/confirm?token='.sentConfirmToken())->assertOk();

    Queue::assertPushed(SyncNewsletterContact::class, fn ($job) => $job->action === 'subscribe');
});

it('envoie le contact à Resend (Http::fake) puis le retire à la désinscription', function () {
    config(['services.resend.newsletter_sync' => true, 'services.resend.key' => 're_test_fictive', 'services.resend.audience_id' => 'aud-1']);
    Http::fake(['api.resend.com/*' => Http::response(['id' => 'contact-123'], 200)]);
    $subscriber = NewsletterSubscriber::forceCreate(['email' => 'abonne@exemple.test', 'status' => 'confirmed', 'consent_at' => now(), 'confirmed_at' => now()]);

    (new SyncNewsletterContact($subscriber->id, SyncNewsletterContact::SUBSCRIBE))->handle();

    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && $request->url() === 'https://api.resend.com/audiences/aud-1/contacts'
        && $request['email'] === 'abonne@exemple.test' && $request['unsubscribed'] === false
        && $request->hasHeader('Authorization', 'Bearer re_test_fictive'));
    expect($subscriber->refresh()->resend_contact_id)->toBe('contact-123');

    $subscriber->forceFill(['status' => 'unsubscribed'])->save();
    (new SyncNewsletterContact($subscriber->id, SyncNewsletterContact::UNSUBSCRIBE))->handle();

    Http::assertSent(fn ($request) => $request->method() === 'PATCH' && str_ends_with($request->url(), '/contacts/contact-123') && $request['unsubscribed'] === true);
    expect($subscriber->refresh()->resend_contact_id)->toBeNull();
});

it('n\'appelle jamais Resend sans drapeau, et ses erreurs ne contiennent pas l\'e-mail', function () {
    $subscriber = NewsletterSubscriber::forceCreate(['email' => 'secret@exemple.test', 'status' => 'confirmed', 'consent_at' => now()]);
    config(['services.resend.newsletter_sync' => false]);
    (new SyncNewsletterContact($subscriber->id, SyncNewsletterContact::SUBSCRIBE))->handle();
    Http::assertNothingSent();

    config(['services.resend.newsletter_sync' => true, 'services.resend.key' => 're_test', 'services.resend.audience_id' => 'aud']);
    Http::fake(['api.resend.com/*' => Http::response(['message' => 'secret@exemple.test refusé'], 500)]);
    try {
        (new SyncNewsletterContact($subscriber->id, SyncNewsletterContact::SUBSCRIBE))->handle();
        $this->fail('Une exception était attendue.');
    } catch (RuntimeException $e) {
        expect($e->getMessage())->not->toContain('secret@exemple.test')->toContain('500');
    }
});

it('purge les abonnés en attente depuis plus de 7 jours, et conserve les désinscrits', function () {
    $old = NewsletterSubscriber::forceCreate(['email' => 'ancien@exemple.test', 'status' => 'pending', 'consent_at' => now()->subDays(9)]);
    $recent = NewsletterSubscriber::forceCreate(['email' => 'recent@exemple.test', 'status' => 'pending', 'consent_at' => now()]);
    $unsub = NewsletterSubscriber::forceCreate(['email' => 'parti@exemple.test', 'status' => 'unsubscribed', 'consent_at' => now()->subDays(40), 'unsubscribed_at' => now()->subDays(30)]);
    $confirmed = NewsletterSubscriber::forceCreate(['email' => 'actif@exemple.test', 'status' => 'confirmed', 'consent_at' => now()->subDays(40)]);
    foreach ([$old, $unsub, $confirmed] as $row) {
        NewsletterSubscriber::whereKey($row->id)->update(['created_at' => now()->subDays(40)]);
    }

    $this->artisan('retention:purge-pending-subscribers')->assertSuccessful();

    expect(NewsletterSubscriber::pluck('email')->all())->toEqualCanonicalizing(['recent@exemple.test', 'parti@exemple.test', 'actif@exemple.test']);
    expect(AuditLog::where('event', 'retention_purge')->count())->toBe(1);
});
