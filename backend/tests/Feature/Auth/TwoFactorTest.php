<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\DB;
use PragmaRX\Google2FA\Google2FA;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
});

it('déroule le flux 2FA complet : activation, confirmation, connexion, codes de secours, anti-rejeu', function () {
    $user = User::factory()->create();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();

    // Activation : secret + QR code SVG.
    $enable = $this->postJson('/api/v1/auth/two-factor/enable')->assertOk()
        ->assertExactJsonStructure(['secret', 'qr_svg']);
    $secret = $enable->json('secret');
    expect($enable->json('qr_svg'))->toStartWith('<svg')->toContain('xmlns="http://www.w3.org/2000/svg"')->toEndWith('</svg>')->not->toContain('<?xml');
    expect($user->fresh()->hasTwoFactorEnabled())->toBeFalse();

    // Secret chiffré en base.
    $raw = DB::table('users')->where('id', $user->id)->value('two_factor_secret');
    expect($raw)->not->toBe($secret)->not->toContain($secret);

    // Confirmation avec un vrai code TOTP (Google2FA::getCurrentOtp).
    $confirm = $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => (new Google2FA)->getCurrentOtp($secret)])
        ->assertOk()->assertExactJsonStructure(['recovery_codes']);
    $codes = $confirm->json('recovery_codes');
    expect($codes)->toHaveCount(8);
    expect(DB::table('users')->where('id', $user->id)->value('two_factor_recovery_codes'))->not->toContain($codes[0]);
    $this->getJson('/api/v1/auth/user')->assertJsonPath('data.two_factor_enabled', true);

    // Déconnexion puis connexion : 2FA exigée.
    $this->postJson('/api/v1/auth/logout')->assertNoContent();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertExactJson(['two_factor' => true]);

    // Code du pas suivant (le pas courant a été consommé par la confirmation).
    $next = totpCode($secret, 1);
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => $next])
        ->assertOk()->assertJsonPath('data.id', $user->id);
    $this->assertAuthenticatedAs($user, 'web');

    // Rejeu du même code refusé.
    $this->postJson('/api/v1/auth/logout')->assertNoContent();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertExactJson(['two_factor' => true]);
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => $next])
        ->assertUnprocessable()->assertJsonValidationErrors(['code']);
    $this->assertGuest('web');

    // Code de secours : accepté une fois.
    $this->postJson('/api/v1/auth/two-factor-challenge', ['recovery_code' => strtoupper($codes[0])])
        ->assertOk()->assertJsonPath('data.id', $user->id);
    expect($user->fresh()->two_factor_recovery_codes)->toHaveCount(7)->not->toContain($codes[0]);

    // Code de secours réutilisé : refusé (après expiration du limiteur 2FA de 5 essais/minute).
    $this->travel(61)->seconds();
    $this->postJson('/api/v1/auth/logout')->assertNoContent();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertExactJson(['two_factor' => true]);
    $this->postJson('/api/v1/auth/two-factor-challenge', ['recovery_code' => $codes[0]])
        ->assertUnprocessable()->assertJsonValidationErrors(['recovery_code']);
    $this->assertGuest('web');

    expect(AuditLog::where('event', 'two_factor_enabled')->count())->toBe(1);
});

it('régénère la session à la validation du code 2FA', function () {
    [$user, $secret] = userWithTwoFactor();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
    $before = app('session.store')->getId();

    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)])->assertOk();

    expect(app('session.store')->getId())->not->toBe($before);
});

it('refuse le challenge sans connexion en attente', function () {
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => '123456'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.code.0', 'La vérification a expiré. Veuillez vous reconnecter.');
});

it('expire la connexion en attente après 5 minutes', function () {
    [$user, $secret] = userWithTwoFactor();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();

    $this->travel(6)->minutes();

    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)])->assertUnprocessable();
    $this->assertGuest('web');
});

it('valide le corps du challenge', function () {
    $this->postJson('/api/v1/auth/two-factor-challenge', [])
        ->assertUnprocessable()->assertJsonValidationErrors(['code', 'recovery_code']);
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => 'abc'])
        ->assertUnprocessable()->assertJsonValidationErrors(['code']);
});

it('verrouille le challenge après 5 échecs et limite à 5 essais par minute', function () {
    [$user, $secret] = userWithTwoFactor();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
    }

    // Connexion en attente annulée : même un bon code est refusé.
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)])
        ->assertUnprocessable()
        ->assertJsonPath('errors.code.0', 'La vérification a expiré. Veuillez vous reconnecter.');

    expect(AuditLog::where('event', 'two_factor_failed')->count())->toBe(5);
    expect(AuditLog::where('event', 'two_factor_lockout')->count())->toBe(1);

    // Nouvelle connexion : le limiteur par utilisateur (5/min) bloque encore.
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertExactJson(['two_factor' => true]);
    $response = $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)]);
    $response->assertStatus(429);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);

    $this->travel(61)->seconds();
    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)])->assertOk();
});

it('refuse la connexion 2FA d\'un compte désactivé entre-temps', function () {
    [$user, $secret] = userWithTwoFactor();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
    $user->forceFill(['is_active' => false])->save();

    $this->postJson('/api/v1/auth/two-factor-challenge', ['code' => totpCode($secret)])->assertUnprocessable();
    $this->assertGuest('web');
});

it('exige une authentification pour gérer la 2FA', function () {
    $this->postJson('/api/v1/auth/two-factor/enable')->assertUnauthorized();
    $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => '123456'])->assertUnauthorized();
    $this->postJson('/api/v1/auth/two-factor/disable', ['password' => 'x'])->assertUnauthorized();
});

it('refuse d\'activer une 2FA déjà confirmée (409)', function () {
    [$user] = userWithTwoFactor();
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/two-factor/enable')
        ->assertStatus(409)
        ->assertExactJson(['message' => 'La double authentification est déjà activée.']);
});

it('valide la confirmation de la 2FA', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => '123456'])
        ->assertUnprocessable()->assertJsonValidationErrors(['code']);

    $this->postJson('/api/v1/auth/two-factor/enable')->assertOk();
    $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => 'abcdef'])
        ->assertUnprocessable()->assertJsonValidationErrors(['code']);
    $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => '000000'])
        ->assertUnprocessable()->assertJsonPath('errors.code.0', 'Le code de vérification est invalide.');
    expect($user->fresh()->hasTwoFactorEnabled())->toBeFalse();
});

it('désactive la 2FA avec le mot de passe', function () {
    [$user] = userWithTwoFactor();
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/two-factor/disable', ['password' => 'Mauvais-mot-de-passe'])
        ->assertUnprocessable()->assertJsonValidationErrors(['password']);
    $this->postJson('/api/v1/auth/two-factor/disable', [])
        ->assertUnprocessable()->assertJsonValidationErrors(['password']);

    $this->postJson('/api/v1/auth/two-factor/disable', ['password' => UserFactory::TEST_PASSWORD])
        ->assertNoContent();

    $fresh = $user->fresh();
    expect($fresh->hasTwoFactorEnabled())->toBeFalse();
    expect($fresh->two_factor_secret)->toBeNull();
    expect($fresh->two_factor_recovery_codes)->toBeNull();
    expect(AuditLog::where('event', 'two_factor_disabled')->count())->toBe(1);
});

it('interdit la désactivation de la 2FA pour admin et editor', function (string $role) {
    [$user] = userWithTwoFactor(User::factory()->role($role));
    $this->actingAs($user);

    $this->postJson('/api/v1/auth/two-factor/disable', ['password' => UserFactory::TEST_PASSWORD])
        ->assertForbidden()
        ->assertExactJson(['message' => 'La double authentification est obligatoire pour les comptes d\'administration.']);

    expect($user->fresh()->hasTwoFactorEnabled())->toBeTrue();
})->with(['admin', 'editor']);
