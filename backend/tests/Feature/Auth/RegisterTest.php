<?php

use App\Models\ConsentLog;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Support\IpHasher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

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

it('crée un compte utilisateur, journalise le consentement et envoie la vérification', function () {
    $response = $this->postJson('/api/v1/auth/register', registrationPayload());

    $response->assertCreated()
        ->assertJsonPath('data.first_name', 'Aya')
        ->assertJsonPath('data.email', 'aya.koffi@example.com')
        ->assertJsonPath('data.phone', '+2250701020304')
        ->assertJsonPath('data.role', 'user')
        ->assertJsonPath('data.email_verified', false)
        ->assertJsonPath('data.two_factor_enabled', false);

    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();

    $consent = ConsentLog::where('user_id', $user->id)->firstOrFail();
    expect($consent->purpose)->toBe('registration')
        ->and($consent->granted)->toBeTrue()
        ->and($consent->policy_version)->toBe(config('app.policy_version'))
        ->and($consent->ip_hash)->toBe(IpHasher::hash('127.0.0.1'));

    Notification::assertSentTo($user, VerifyEmailNotification::class);

    // Session ouverte après inscription (renvoi du lien de vérification possible).
    $this->assertAuthenticatedAs($user, 'web');
    $this->postJson('/api/v1/auth/email/resend')->assertStatus(202);

    expect(DB::table('users')->where('id', $user->id)->value('password'))->toStartWith('$argon2id$');
});

it('n\'applique jamais un rôle ni un statut envoyés dans la requête', function () {
    $this->postJson('/api/v1/auth/register', registrationPayload([
        'role' => 'admin',
        'is_active' => false,
        'email_verified_at' => now()->toIso8601String(),
    ]))->assertCreated()->assertJsonPath('data.role', 'user');

    $user = User::where('email', 'aya.koffi@example.com')->firstOrFail();
    expect($user->role)->toBe('user')
        ->and($user->is_active)->toBeTrue()
        ->and($user->email_verified_at)->toBeNull();
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

it('renvoie un message générique si l\'email est déjà utilisé', function () {
    User::factory()->create(['email' => 'aya.koffi@example.com']);

    $this->postJson('/api/v1/auth/register', registrationPayload(['email' => 'AYA.KOFFI@example.com']))
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'Impossible de créer le compte avec ces informations.');
    Notification::assertNothingSent();
});

it('limite les inscriptions à 5 par heure et par IP', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/register', registrationPayload(['email' => "personne{$i}@example.com"]))->assertCreated();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        // Requête suivante = nouveau processus en production : gardes réinitialisées.
        $this->app['auth']->forgetGuards();
    }

    $response = $this->postJson('/api/v1/auth/register', registrationPayload(['email' => 'personne6@example.com']));
    $response->assertStatus(429);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);
});
