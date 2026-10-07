<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
    config(['auth.forgot_password_timebox_ms' => 0]);
    Notification::fake();
});

function requestResetToken(User $user): string
{
    test()->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();

    $token = null;
    Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $n) use (&$token) {
        $token = $n->token;

        return true;
    });

    return $token;
}

it('renvoie la même réponse que le compte existe, soit inactif ou non, et n\'envoie qu\'aux comptes actifs', function () {
    $user = User::factory()->create();
    $inactive = User::factory()->inactive()->create();

    $expected = ['message' => 'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d\'être envoyé.'];

    $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk()->assertExactJson($expected);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'inconnu@example.com'])->assertOk()->assertExactJson($expected);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => $inactive->email])->assertOk()->assertExactJson($expected);

    Notification::assertSentTo($user, ResetPasswordNotification::class);
    Notification::assertNotSentTo($inactive, ResetPasswordNotification::class);
    Notification::assertCount(1);
});

it('impose une durée minimale de réponse au mot de passe oublié', function () {
    config(['auth.forgot_password_timebox_ms' => 150]);

    $start = microtime(true);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'inconnu@example.com'])->assertOk();

    expect(microtime(true) - $start)->toBeGreaterThanOrEqual(0.15);
});

it('construit le lien de réinitialisation vers le front', function () {
    $user = User::factory()->create(['email' => 'awa@example.com']);
    $token = requestResetToken($user);

    $url = (new ResetPasswordNotification($token))->resetUrl($user);

    expect($url)->toBe('http://localhost:3000/reinitialiser-mot-de-passe?token='.$token.'&email=awa%40example.com');
});

it('valide la demande de réinitialisation', function () {
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'pas-un-email'])
        ->assertUnprocessable()->assertJsonValidationErrors(['email']);
});

it('limite le mot de passe oublié à 3 par heure par email et 10 par heure par IP', function () {
    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'cible@example.com'])->assertOk();
    }
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'cible@example.com'])
        ->assertStatus(429)->assertHeader('Retry-After');

    // Les requêtes refusées ne comptent pas : 3 + 7 = 10 acceptées pour cette IP.
    foreach (range(1, 7) as $i) {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => "autre{$i}@example.com"])->assertOk();
    }
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'encore@example.com'])->assertStatus(429);
});

it('réinitialise le mot de passe et invalide toutes les sessions', function () {
    $user = User::factory()->create();
    $user->forceFill(['remember_token' => 'ancien-jeton'])->save();
    DB::table('sessions')->insert([
        ['id' => 'session-a', 'user_id' => $user->id, 'payload' => 'x', 'last_activity' => time()],
        ['id' => 'session-b', 'user_id' => $user->id, 'payload' => 'x', 'last_activity' => time()],
    ]);
    $token = requestResetToken($user);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token,
        'email' => $user->email,
        'password' => 'Nouveau-Mot-2026',
        'password_confirmation' => 'Nouveau-Mot-2026',
    ])->assertOk()->assertExactJson(['message' => 'Votre mot de passe a été réinitialisé.']);

    $fresh = $user->fresh();
    expect(Hash::check('Nouveau-Mot-2026', $fresh->password))->toBeTrue()
        ->and($fresh->getRememberToken())->not->toBe('ancien-jeton')
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(DB::table('password_reset_tokens')->where('email', $user->email)->exists())->toBeFalse()
        ->and(AuditLog::where('event', 'password_reset')->where('auditable_id', $user->id)->exists())->toBeTrue();

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Nouveau-Mot-2026'])->assertOk();
});

it('refuse un jeton invalide', function () {
    $user = User::factory()->create();
    requestResetToken($user);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'jeton-invalide',
        'email' => $user->email,
        'password' => 'Nouveau-Mot-2026',
        'password_confirmation' => 'Nouveau-Mot-2026',
    ])->assertUnprocessable()->assertJsonPath('errors.email.0', 'Ce lien de réinitialisation est invalide ou a expiré.');

    expect(Hash::check(UserFactory::TEST_PASSWORD, $user->fresh()->password))->toBeTrue();
});

it('refuse un jeton expiré', function () {
    $user = User::factory()->create();
    $token = requestResetToken($user);

    $this->travel(61)->minutes();

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token,
        'email' => $user->email,
        'password' => 'Nouveau-Mot-2026',
        'password_confirmation' => 'Nouveau-Mot-2026',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email']);
});

it('applique la règle de longueur du rôle à la réinitialisation (10 user, 12 provider)', function () {
    $user = User::factory()->create();
    $token = requestResetToken($user);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token, 'email' => $user->email,
        'password' => 'Neuf-chars', 'password_confirmation' => 'Neuf-chars',
    ])->assertOk();

    $provider = User::factory()->provider()->create();
    $token = requestResetToken($provider);

    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token, 'email' => $provider->email,
        'password' => 'Onze-chars1', 'password_confirmation' => 'Onze-chars1',
    ])->assertUnprocessable()->assertJsonValidationErrors(['password']);

    // Jeton non consommé : une nouvelle tentative conforme réussit.
    $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token, 'email' => $provider->email,
        'password' => 'Douze-chars1', 'password_confirmation' => 'Douze-chars1',
    ])->assertOk();
});

it('valide la réinitialisation sans jeton valide avec le socle commun uniquement', function () {
    $this->postJson('/api/v1/auth/reset-password', [])
        ->assertUnprocessable()->assertJsonValidationErrors(['token', 'email', 'password']);

    // Mot de passe trop court (< 10) : refusé avant toute vérification du compte.
    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'x', 'email' => 'inconnu@example.com', 'password' => 'Court-1', 'password_confirmation' => 'Court-1',
    ])->assertUnprocessable()->assertJsonValidationErrors(['password']);

    // 11 caractères sur un email inconnu : erreur de jeton (aucune information sur le rôle).
    $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'x', 'email' => 'inconnu@example.com', 'password' => 'Onze-chars1', 'password_confirmation' => 'Onze-chars1',
    ])->assertUnprocessable()->assertJsonMissingValidationErrors(['password'])->assertJsonValidationErrors(['email']);
});
