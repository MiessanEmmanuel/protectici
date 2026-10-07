<?php

use App\Logging\RedactSensitiveData;
use App\Models\ConsentLog;
use App\Models\User;
use App\Notifications\AlreadyRegisteredNotification;
use App\Notifications\VerifyEmailNotification;
use App\Support\IpHasher;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
    Notification::fake();
});

function registrationPayload(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Aya',
        'last_name' => 'Koffi',
        'email' => 'aya.koffi@example.com',
        'password' => 'Abidjan-2026',
        'password_confirmation' => 'Abidjan-2026',
        'phone' => '07 01 02 03 04',
        'consent' => true,
    ], $overrides);
}

const REGISTER_MESSAGE = 'Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte.';

it('crée un compte non vérifié, journalise le consentement, envoie le lien et n\'ouvre aucune session', function () {
    $response = $this->postJson('/api/v1/auth/register', registrationPayload());

    $response->assertStatus(202)->assertExactJson(['message' => REGISTER_MESSAGE]);
    expect(collect($response->headers->getCookies())->pluck('name')->all())->not->toContain('protectici_session'); // aucune session
    $this->assertGuest('web');

    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();
    expect($user->role)->toBe('user')->and($user->is_active)->toBeTrue()->and($user->email_verified_at)->toBeNull()
        ->and($user->phone)->toBe('+2250701020304');

    $consent = ConsentLog::where('user_id', $user->id)->firstOrFail();
    expect($consent->purpose)->toBe('registration')->and($consent->granted)->toBeTrue()
        ->and($consent->ip_hash)->toBe(IpHasher::hash('127.0.0.1'));

    Notification::assertSentTo($user, VerifyEmailNotification::class);
    expect(DB::table('users')->where('id', $user->id)->value('password'))->toStartWith('$argon2id$');
});

it('renvoie exactement la même réponse pour une adresse nouvelle, vérifiée ou non vérifiée', function () {
    User::factory()->create(['email' => 'verifie@example.com']);
    User::factory()->unverified()->create(['email' => 'attente@example.com']);

    $responses = collect(['nouveau@example.com', 'verifie@example.com', 'attente@example.com'])
        ->map(function ($email) {
            $r = $this->postJson('/api/v1/auth/register', registrationPayload(['email' => $email]));
            $this->app['auth']->forgetGuards();

            return $r;
        });

    foreach ($responses as $r) {
        $r->assertStatus(202);
        expect($r->getContent())->toBe($responses[0]->getContent());
        expect(collect($r->headers->getCookies())->pluck('name')->all())->not->toContain('protectici_session');
    }
});

it('égalise la durée de réponse (Timebox)', function () {
    config(['auth.register_timebox_ms' => 300]);
    User::factory()->create(['email' => 'verifie@example.com']);

    foreach (['nouveau@example.com', 'verifie@example.com'] as $email) {
        $start = microtime(true);
        $this->postJson('/api/v1/auth/register', registrationPayload(['email' => $email]))->assertStatus(202);
        expect((microtime(true) - $start) * 1000)->toBeGreaterThanOrEqual(290);
    }
});

it('adresse déjà vérifiée : e-mail « déjà un compte », compte inchangé', function () {
    $user = User::factory()->create(['email' => 'aya.koffi@example.com', 'first_name' => 'Ancien']);
    $hash = $user->password;

    $this->postJson('/api/v1/auth/register', registrationPayload())->assertStatus(202);

    Notification::assertSentTo($user, AlreadyRegisteredNotification::class);
    Notification::assertNotSentTo($user, VerifyEmailNotification::class);
    $fresh = $user->fresh();
    expect($fresh->first_name)->toBe('Ancien')->and($fresh->password)->toBe($hash);

    $mail = (new AlreadyRegisteredNotification)->toMail($user);
    expect($mail->subject)->toBe('Vous avez déjà un compte - ProtectIci')
        ->and($mail->actionUrl)->toBe('http://localhost:3000/connexion');
});

it('neutralise le pré-détournement : les nouvelles données remplacent celles d\'un compte non vérifié', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload(['first_name' => 'Pirate', 'password' => 'Pirate-Pass-2026', 'password_confirmation' => 'Pirate-Pass-2026']))->assertStatus(202);
    $this->app['auth']->forgetGuards();
    $this->postJson('/api/v1/auth/register', registrationPayload(['first_name' => 'Victime']))->assertStatus(202);

    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();
    expect(User::count())->toBe(1)
        ->and($user->first_name)->toBe('Victime')
        ->and(Hash::check('Abidjan-2026', $user->password))->toBeTrue()
        ->and(Hash::check('Pirate-Pass-2026', $user->password))->toBeFalse()
        ->and($user->email_verified_at)->toBeNull();
});

it('n\'applique jamais un rôle ni un statut envoyés dans la requête', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload(['role' => 'admin', 'is_active' => false, 'email_verified_at' => now()->toIso8601String()]))
        ->assertStatus(202);

    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();
    expect($user->role)->toBe('user')->and($user->is_active)->toBeTrue()->and($user->email_verified_at)->toBeNull();
});

it('valide les champs d\'inscription', function () {
    $this->postJson('/api/v1/auth/register', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['first_name', 'last_name', 'email', 'password', 'consent']);
});

it('exige le consentement', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload(['consent' => false]))
        ->assertUnprocessable()->assertJsonValidationErrors(['consent']);
    expect(User::count())->toBe(0);
});

it('exige 10 caractères minimum et la confirmation du mot de passe', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload(['password' => 'Court-123', 'password_confirmation' => 'Court-123']))
        ->assertUnprocessable()->assertJsonValidationErrors(['password']);
    $this->postJson('/api/v1/auth/register', registrationPayload(['password_confirmation' => 'Autre-chose-2026']))
        ->assertUnprocessable()->assertJsonValidationErrors(['password']);
});

it('refuse un téléphone invalide', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload(['phone' => '12ab']))
        ->assertUnprocessable()->assertJsonValidationErrors(['phone']);
});

it('limite les inscriptions à 5 par heure et par IP', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/register', registrationPayload(['email' => "personne{$i}@example.com"]))->assertStatus(202);
        $this->app['auth']->forgetGuards();
    }

    $response = $this->postJson('/api/v1/auth/register', registrationPayload(['email' => 'personne6@example.com']));
    $response->assertStatus(429);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);
});

it('limite à 3 e-mails par heure et par adresse sans changer la réponse', function () {
    foreach (range(1, 5) as $i) {
        $r = $this->postJson('/api/v1/auth/register', registrationPayload());
        $r->assertStatus(202)->assertExactJson(['message' => REGISTER_MESSAGE]);
        $this->app['auth']->forgetGuards();
    }

    Notification::assertSentToTimes(User::firstOrFail(), VerifyEmailNotification::class, 3);
});

it('purge les comptes non vérifiés de plus de 7 jours', function () {
    $old = User::factory()->unverified()->create(['created_at' => now()->subDays(8)]);
    $recent = User::factory()->unverified()->create(['created_at' => now()->subDays(6)]);
    $verifiedOld = User::factory()->create(['created_at' => now()->subDays(30)]);
    $adminOld = User::factory()->admin()->unverified()->create(['created_at' => now()->subDays(30)]);

    $this->artisan('app:purge-unverified-users')->assertSuccessful();

    expect(User::withTrashed()->find($old->id))->toBeNull()
        ->and(User::find($recent->id))->not->toBeNull()
        ->and(User::find($verifiedOld->id))->not->toBeNull()
        ->and(User::find($adminOld->id))->not->toBeNull();
    expect(collect(app(Schedule::class)->events())->contains(fn ($e) => str_contains($e->command, 'app:purge-unverified-users')))->toBeTrue();
});

it('un compte non vérifié ne peut pas se connecter et reçoit un nouveau lien (3/h)', function () {
    $user = User::factory()->unverified()->create();

    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/login', loginPayload($user))
            ->assertForbidden()
            ->assertExactJson(['message' => 'Veuillez confirmer votre adresse e-mail. Un nouveau lien vient de vous être envoyé.', 'code' => 'email_unverified']);
        $this->app['auth']->forgetGuards();
    }
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertForbidden();
    Notification::assertSentToTimes($user, VerifyEmailNotification::class, 3);
    $this->assertGuest('web');

    // Mauvais mot de passe : 422 générique, aucun envoi, indiscernable d'un compte inconnu.
    $wrong = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'faux-mot-de-passe']);
    $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@example.com', 'password' => 'faux-mot-de-passe']);
    $wrong->assertUnprocessable();
    expect($wrong->getContent())->toBe($unknown->getContent());
});

it('clic sur le lien : vérifie, connecte automatiquement, usage unique', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload())->assertStatus(202);
    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();
    $url = (new VerifyEmailNotification)->verificationUrl($user);
    $this->app['auth']->forgetGuards();

    // Clic depuis un e-mail : aucun Origin/Referer.
    $this->flushHeaders();
    $this->get($url)->assertRedirect('http://localhost:3000/compte?verified=1');
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    $this->assertAuthenticatedAs($user, 'web');

    // Rejeu : refusé, sans nouvelle session.
    $this->app['auth']->forgetGuards();
    $this->flushSession();
    $this->get($url)->assertRedirect('http://localhost:3000/connexion?verified=0');
    $this->assertGuest('web');
});

it('lien expiré ou falsifié : aucune vérification, aucune session', function () {
    $user = User::factory()->unverified()->create();
    $url = (new VerifyEmailNotification)->verificationUrl($user);

    $this->get($url.'0')->assertRedirect('http://localhost:3000/connexion?verified=0');
    $forged = URL::temporarySignedRoute('auth.verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1('autre@example.com')]);
    $this->get($forged)->assertRedirect('http://localhost:3000/connexion?verified=0');
    $this->travel(61)->minutes();
    $this->get($url)->assertRedirect('http://localhost:3000/connexion?verified=0');

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
    $this->assertGuest('web');
});

it('pas de connexion automatique pour un compte désactivé ni pour admin/editor', function () {
    $inactive = User::factory()->unverified()->inactive()->create();
    $this->get((new VerifyEmailNotification)->verificationUrl($inactive))->assertRedirect('http://localhost:3000/connexion?verified=0');
    expect($inactive->fresh()->hasVerifiedEmail())->toBeFalse();
    $this->assertGuest('web');

    $admin = User::factory()->admin()->unverified()->create();
    $this->get((new VerifyEmailNotification)->verificationUrl($admin))->assertRedirect('http://localhost:3000/compte?verified=1');
    expect($admin->fresh()->hasVerifiedEmail())->toBeTrue();
    $this->assertGuest('web');
});

it('ne journalise pas les liens signés des e-mails', function () {
    config(['mail.log_links' => false]);
    $line = 'Lien : http://localhost:8000/api/v1/auth/verify-email/12/'.str_repeat('a', 40)."?expires=1=\r\n&signature=3Dabc123def456 et token=3Dsecret";

    $clean = RedactSensitiveData::scrubString($line);

    expect($clean)->not->toContain('abc123def456')->not->toContain('secret')->not->toContain(str_repeat('a', 40));
});

const RESEND_MESSAGE = "Si cette adresse correspond à un compte non confirmé, un nouvel e-mail vient d'être envoyé.";

it('renvoi public : même 202 dans tous les cas, e-mail seulement pour un compte actif non vérifié', function () {
    $pending = User::factory()->unverified()->create(['email' => 'attente@example.com']);
    $verified = User::factory()->create(['email' => 'ok@example.com']);
    $inactive = User::factory()->unverified()->inactive()->create(['email' => 'off@example.com']);

    $bodies = [];
    foreach (['attente@example.com', 'ok@example.com', 'off@example.com', 'inconnu@example.com'] as $email) {
        $r = $this->postJson('/api/v1/auth/verification/resend', ['email' => $email])->assertStatus(202)->assertExactJson(['message' => RESEND_MESSAGE]);
        $bodies[] = $r->getContent();
        $this->app['auth']->forgetGuards();
    }

    expect(array_unique($bodies))->toHaveCount(1);
    Notification::assertSentToTimes($pending, VerifyEmailNotification::class, 1);
    Notification::assertNotSentTo([$verified, $inactive], VerifyEmailNotification::class);
    Notification::assertSentTimes(VerifyEmailNotification::class, 1);
});

it('renvoi public : 3 e-mails/heure/adresse et 10/heure/IP sans changer la réponse', function () {
    $user = User::factory()->unverified()->create(['email' => 'attente@example.com']);

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/verification/resend', ['email' => 'attente@example.com'])->assertStatus(202)->assertExactJson(['message' => RESEND_MESSAGE]);
    }
    Notification::assertSentToTimes($user, VerifyEmailNotification::class, 3);

    // Limite IP : après 10 demandes, plus aucun e-mail même pour une autre adresse non vérifiée.
    $other = User::factory()->unverified()->create(['email' => 'autre@example.com']);
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/verification/resend', ['email' => 'inconnu'.$i.'@example.com'])->assertStatus(202);
    }
    $this->postJson('/api/v1/auth/verification/resend', ['email' => 'autre@example.com'])->assertStatus(202)->assertExactJson(['message' => RESEND_MESSAGE]);
    Notification::assertNothingSentTo($other);
});

it('renvoi public : valide l\'e-mail et égalise la durée', function () {
    $this->postJson('/api/v1/auth/verification/resend', ['email' => 'pas-un-email'])->assertUnprocessable()->assertJsonValidationErrors('email');

    config(['auth.register_timebox_ms' => 300]);
    $start = microtime(true);
    $this->postJson('/api/v1/auth/verification/resend', ['email' => 'inconnu@example.com'])->assertStatus(202);
    expect((microtime(true) - $start) * 1000)->toBeGreaterThanOrEqual(290);
});
