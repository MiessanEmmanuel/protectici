<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
});

it('change le mot de passe, ferme les autres sessions et régénère la session courante', function () {
    $user = User::factory()->create();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
    $user->forceFill(['remember_token' => 'ancien-jeton'])->saveQuietly();
    DB::table('sessions')->insert(['id' => 'autre-appareil', 'user_id' => $user->id, 'payload' => 'x', 'last_activity' => time()]);
    $before = app('session.store')->getId();

    $this->putJson('/api/v1/auth/password', [
        'current_password' => UserFactory::TEST_PASSWORD,
        'password' => 'Nouveau-2026',
        'password_confirmation' => 'Nouveau-2026',
    ])->assertNoContent();

    $fresh = $user->fresh();
    expect(Hash::check('Nouveau-2026', $fresh->password))->toBeTrue()
        ->and($fresh->getRememberToken())->not->toBe('ancien-jeton')
        ->and(DB::table('sessions')->where('id', 'autre-appareil')->exists())->toBeFalse()
        ->and(app('session.store')->getId())->not->toBe($before)
        ->and(AuditLog::where('event', 'password_changed')->exists())->toBeTrue();

    // La session courante reste valide.
    $this->getJson('/api/v1/auth/user')->assertOk();
});

it('exige le mot de passe actuel', function () {
    $this->actingAs(User::factory()->create());

    $this->putJson('/api/v1/auth/password', [
        'current_password' => 'Mauvais-mot-de-passe',
        'password' => 'Nouveau-2026',
        'password_confirmation' => 'Nouveau-2026',
    ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);

    $this->putJson('/api/v1/auth/password', [])
        ->assertUnprocessable()->assertJsonValidationErrors(['current_password', 'password']);
});

it('accepte 10 caractères pour un utilisateur simple', function () {
    $user = User::factory()->create();
    $this->actingAs($user);
    $this->putJson('/api/v1/auth/password', [
        'current_password' => UserFactory::TEST_PASSWORD,
        'password' => 'Dix-chars1',
        'password_confirmation' => 'Dix-chars1',
    ])->assertNoContent();
});

it('exige 12 caractères pour un prestataire', function () {
    $provider = User::factory()->provider()->create();
    $this->actingAs($provider);
    $this->putJson('/api/v1/auth/password', [
        'current_password' => UserFactory::TEST_PASSWORD,
        'password' => 'Onze-chars1',
        'password_confirmation' => 'Onze-chars1',
    ])->assertUnprocessable()->assertJsonValidationErrors(['password']);
});

it('exige une authentification', function () {
    $this->putJson('/api/v1/auth/password', [])->assertUnauthorized();
});
