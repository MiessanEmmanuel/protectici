<?php

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
    Notification::fake();
});

it('vérifie l\'email via un lien signé valide et redirige vers le front', function () {
    $user = User::factory()->unverified()->create();
    $url = (new VerifyEmailNotification)->verificationUrl($user);

    expect($url)->toContain('/api/v1/auth/verify-email/'.$user->id.'/'.sha1($user->email));

    $this->get($url)->assertRedirect('http://localhost:3000/compte?verified=1');
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();

    // Lien déjà utilisé : refusé (usage unique).
    $this->get($url)->assertRedirect('http://localhost:3000/connexion?verified=0');
});

it('redirige en échec pour une signature invalide', function () {
    $user = User::factory()->unverified()->create();
    $url = (new VerifyEmailNotification)->verificationUrl($user);

    $this->get($url.'0')->assertRedirect('http://localhost:3000/connexion?verified=0');
    $this->get('/api/v1/auth/verify-email/'.$user->id.'/'.sha1($user->email))->assertRedirect('http://localhost:3000/connexion?verified=0');
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('redirige en échec pour un lien expiré', function () {
    $user = User::factory()->unverified()->create();
    $url = (new VerifyEmailNotification)->verificationUrl($user);

    $this->travel(61)->minutes();

    $this->get($url)->assertRedirect('http://localhost:3000/connexion?verified=0');
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('redirige en échec pour un hash ne correspondant pas ou un compte inexistant', function () {
    $user = User::factory()->unverified()->create();

    $badHash = URL::temporarySignedRoute('auth.verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1('autre@example.com')]);
    $unknown = URL::temporarySignedRoute('auth.verification.verify', now()->addHour(), ['id' => 999999, 'hash' => sha1('x@example.com')]);

    $this->get($badHash)->assertRedirect('http://localhost:3000/connexion?verified=0');
    $this->get($unknown)->assertRedirect('http://localhost:3000/connexion?verified=0');
    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('ignore tout paramètre de redirection fourni (pas de redirection ouverte)', function () {
    $user = User::factory()->unverified()->create();
    $url = (new VerifyEmailNotification)->verificationUrl($user);

    $this->get($url.'&redirect=https://evil.example')->assertRedirect('http://localhost:3000/connexion?verified=0');
});

it('renvoie le lien de vérification (202) à un compte non vérifié', function () {
    $user = User::factory()->unverified()->create();
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/email/resend')->assertStatus(202);

    Notification::assertSentTo($user, VerifyEmailNotification::class);
});

it('ne renvoie rien si l\'email est déjà vérifié', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/email/resend')->assertStatus(202);

    Notification::assertNothingSent();
});

it('exige une authentification pour le renvoi', function () {
    $this->postJson('/api/v1/auth/email/resend')->assertUnauthorized();
});

it('limite le renvoi à 3 par heure', function () {
    $user = User::factory()->unverified()->create();
    $this->actingAs($user);

    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/email/resend')->assertStatus(202);
    }
    $this->postJson('/api/v1/auth/email/resend')->assertStatus(429)->assertHeader('Retry-After');
});

it('rédige l\'email de vérification en français', function () {
    $user = User::factory()->unverified()->create(['first_name' => 'Awa']);

    $mail = (new VerifyEmailNotification)->toMail($user);

    expect($mail->subject)->toBe('Confirmez votre adresse e-mail - ProtectIci')
        ->and($mail->greeting)->toBe('Bonjour Awa,')
        ->and($mail->actionText)->toBe('Confirmer mon adresse e-mail');
});
