<?php

use App\Models\AuditLog;
use App\Models\ConsentLog;
use App\Models\ContactMessage;
use App\Models\IdempotencyKey;
use App\Models\User;
use App\Notifications\Admin\AdminAlert;
use App\Notifications\Contact\ContactMail;
use Illuminate\Support\Facades\Notification;

const CONTACT_URL = '/api/v1/contact';

beforeEach(fn () => Notification::fake());

function contactPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Koffi Yao',
        'email' => 'koffi.yao@exemple.test',
        'subject' => 'Question sur la formation',
        'message' => 'Bonjour, je souhaite connaître les prochaines dates de formation.',
        'consent' => true,
    ], $overrides);
}

function makeContactMessage(array $attributes = []): ContactMessage
{
    $message = new ContactMessage;
    $message->forceFill($attributes + [
        'name' => 'Koffi Yao', 'email' => 'koffi.yao@exemple.test', 'subject' => 'Sujet de test',
        'message' => 'Un message de test suffisamment long.', 'consent_at' => now(),
    ])->save();

    return $message->refresh();
}

it('enregistre un message de contact, accuse réception en file et alerte les administrateurs', function () {
    makeAdmin();

    $this->postJson(CONTACT_URL, contactPayload())->assertCreated()->assertExactJson(['data' => ['message' => 'Merci, votre message a bien été envoyé.']]);

    $message = ContactMessage::query()->firstOrFail();
    expect($message->status)->toBe('new')->and($message->ip_hash)->not->toBeNull()->and($message->consent_at)->not->toBeNull();
    expect(ConsentLog::query()->where('purpose', 'contact')->count())->toBe(1);
    Notification::assertSentOnDemand(ContactMail::class, fn (ContactMail $m, $channels, $notifiable) => $notifiable->routes['mail'] === 'koffi.yao@exemple.test' && $m->event === ContactMail::RECEIVED);
    Notification::assertSentTo(User::query()->where('role', 'admin')->get(), AdminAlert::class, fn (AdminAlert $a) => $a->kind === AdminAlert::KIND_CONTACT_RECEIVED);
});

it('valide le formulaire de contact', function () {
    $this->postJson(CONTACT_URL, [])->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'subject', 'message', 'consent']);
    $this->postJson(CONTACT_URL, contactPayload(['message' => 'court']))->assertUnprocessable()->assertJsonValidationErrors(['message']);
    $this->postJson(CONTACT_URL, contactPayload(['email' => 'pas-un-email']))->assertUnprocessable()->assertJsonValidationErrors(['email']);
    $this->postJson(CONTACT_URL, contactPayload(['subject' => str_repeat('a', 201)]))->assertUnprocessable()->assertJsonValidationErrors(['subject']);
    $this->postJson(CONTACT_URL, contactPayload(['consent' => false]))->assertUnprocessable();
    expect(ContactMessage::query()->count())->toBe(0);
});

it('nettoie les balises et les caractères de contrôle', function () {
    $this->postJson(CONTACT_URL, contactPayload(['subject' => "Bonjour\r\nBcc: pirate@exemple.test <b>x</b>", 'message' => '<script>x</script>Un message assez long pour passer.']))->assertCreated();
    $message = ContactMessage::query()->firstOrFail();
    expect($message->subject)->not->toContain("\n")->not->toContain('<')->and($message->message)->not->toContain('<');
});

it('champ piège rempli : succès simulé identique, rien enregistré ni envoyé', function () {
    $this->postJson(CONTACT_URL, contactPayload(['company_website' => 'http://spam.example']))->assertCreated()
        ->assertExactJson(['data' => ['message' => 'Merci, votre message a bien été envoyé.']]);
    expect(ContactMessage::query()->count())->toBe(0)->and(ConsentLog::query()->count())->toBe(0)->and(IdempotencyKey::query()->count())->toBe(0);
    Notification::assertNothingSent();
});

it('idempotence : même clé = un seul message et un seul e-mail', function () {
    $headers = ['Idempotency-Key' => 'cle-contact-00001'];
    $this->withHeaders($headers)->postJson(CONTACT_URL, contactPayload())->assertCreated();
    $this->withHeaders($headers)->postJson(CONTACT_URL, contactPayload())->assertCreated();
    expect(ContactMessage::query()->count())->toBe(1);
    Notification::assertSentOnDemandTimes(ContactMail::class, 1);
    $this->withHeaders($headers)->postJson(CONTACT_URL, contactPayload(['subject' => 'Autre sujet']))->assertUnprocessable();
});

it('limite à 5 / heure / IP (429 + Retry-After)', function () {
    config(['public_forms.limits.contact.ip_per_hour' => 2]);
    $this->postJson(CONTACT_URL, contactPayload(['email' => 'a@exemple.test']))->assertCreated();
    $this->postJson(CONTACT_URL, contactPayload(['email' => 'b@exemple.test']))->assertCreated();
    $this->postJson(CONTACT_URL, contactPayload(['email' => 'c@exemple.test']))->assertStatus(429)->assertHeader('Retry-After');
    expect(ContactMessage::query()->count())->toBe(2);
});

it('protège toutes les routes admin du contact', function () {
    $routes = [['get', '/api/v1/admin/contact-messages'], ['patch', '/api/v1/admin/contact-messages/1'], ['post', '/api/v1/admin/contact-messages/1/reply']];
    foreach ($routes as [$method, $url]) {
        $this->{$method.'Json'}($url)->assertUnauthorized();
    }
    foreach ($routes as [$method, $url]) {
        foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $actor) {
            $this->actingAs($actor)->{$method.'Json'}($url)->assertForbidden();
        }
    }
});

it('liste les messages (défaut : nouveaux), filtre et recherche', function () {
    $admin = makeAdmin();
    makeContactMessage(['name' => 'Alpha', 'subject' => 'Devis gardiennage']);
    makeContactMessage(['name' => 'Bêta', 'status' => 'read']);

    $new = $this->actingAs($admin)->getJson('/api/v1/admin/contact-messages')->assertOk();
    expect($new->json('meta.total'))->toBe(1)->and($new->json('data.0'))->toHaveKeys(['id', 'name', 'email', 'subject', 'message', 'status', 'handled_by', 'handled_at', 'created_at']);
    expect($this->actingAs($admin)->getJson('/api/v1/admin/contact-messages?status=read')->json('data.0.name'))->toBe('Bêta');
    expect($this->actingAs($admin)->getJson('/api/v1/admin/contact-messages?q=gardiennage')->json('meta.total'))->toBe(1);
    $this->actingAs($admin)->getJson('/api/v1/admin/contact-messages?status=bidon')->assertUnprocessable();
});

it('change le statut, trace le traitement et audite (idempotent)', function () {
    $admin = makeAdmin();
    $message = makeContactMessage();
    $url = '/api/v1/admin/contact-messages/'.$message->id;

    $this->actingAs($admin)->patchJson($url, ['status' => 'read'])->assertOk()->assertJsonPath('data.status', 'read')->assertJsonPath('data.handled_by.id', $admin->id);
    $this->actingAs($admin)->patchJson($url, ['status' => 'read'])->assertOk();
    expect(AuditLog::query()->where('event', 'contact_message_status_changed')->count())->toBe(1);
    $this->actingAs($admin)->patchJson($url, ['status' => 'bidon'])->assertUnprocessable();
    $this->actingAs($admin)->patchJson($url, [])->assertUnprocessable();
    $this->actingAs($admin)->patchJson('/api/v1/admin/contact-messages/999999', ['status' => 'read'])->assertNotFound();
});

it('répond par e-mail une seule fois', function () {
    $admin = makeAdmin();
    $message = makeContactMessage();
    $url = '/api/v1/admin/contact-messages/'.$message->id.'/reply';

    $this->actingAs($admin)->postJson($url, ['body' => 'abc'])->assertUnprocessable();
    $this->actingAs($admin)->postJson($url, ['body' => 'Voici notre réponse détaillée.'])->assertOk()->assertJsonPath('data.status', 'answered');
    Notification::assertSentOnDemand(ContactMail::class, fn (ContactMail $m, $c, $notifiable) => $m->event === ContactMail::REPLY && $notifiable->routes['mail'] === 'koffi.yao@exemple.test');

    $this->actingAs($admin)->postJson($url, ['body' => 'Voici une seconde réponse.'])->assertStatus(409);
    Notification::assertSentOnDemandTimes(ContactMail::class, 1);
    expect(AuditLog::query()->where('event', 'contact_message_replied')->count())->toBe(1);
});

it('échappe le Markdown du texte tiers dans les e-mails', function () {
    $mail = (new ContactMail(ContactMail::REPLY, 'Koffi', 'Sujet [lien](http://pirate.example)', "Ligne **grasse**\n[clic](http://pirate.example)"))->toMail(new stdClass);
    $rendered = implode("\n", array_merge($mail->introLines, $mail->outroLines));
    expect($rendered)->not->toContain('[lien](')->not->toContain('[clic](')->toContain('\\[clic\\]');
});

it('affiche les compteurs de file de modération dans le tableau de bord', function () {
    $admin = makeAdmin();
    makeContactMessage();
    makeContactMessage(['status' => 'read']);
    makeFeedback();

    $data = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->json('data');
    expect($data)->toHaveKeys(['pending_reviews', 'open_review_reports', 'new_feedbacks', 'new_quote_requests', 'new_contact_messages'])
        ->and($data['new_contact_messages'])->toBe(1)->and($data['new_feedbacks'])->toBe(1)->and($data['pending_reviews'])->toBe(0);
});
