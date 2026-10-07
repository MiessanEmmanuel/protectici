<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
});

/** Simule une nouvelle requête HTTP (en production, les gardes sont recréées à chaque requête). */
function nextRequest(): void
{
    app('auth')->forgetGuards();
}

it('renvoie l\'utilisateur connecté', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->getJson('/api/v1/auth/user')->assertOk()->assertJsonPath('data.id', $user->id);
});

it('renvoie 401 sur /auth/user pour un anonyme', function () {
    $this->getJson('/api/v1/auth/user')->assertUnauthorized()->assertExactJson(['message' => 'Authentification requise.']);
});

it('déconnecte, invalide la session et régénère le jeton CSRF', function () {
    $user = User::factory()->create();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
    $tokenBefore = app('session.store')->token();
    $idBefore = app('session.store')->getId();

    $this->postJson('/api/v1/auth/logout')->assertNoContent();

    expect(app('session.store')->token())->not->toBe($tokenBefore);
    expect(app('session.store')->getId())->not->toBe($idBefore);
    $this->assertGuest('web');
    nextRequest();
    $this->getJson('/api/v1/auth/user')->assertUnauthorized();
});

it('refuse la déconnexion à un anonyme', function () {
    $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
});

it('déconnecte un compte désactivé pendant sa session', function () {
    $user = User::factory()->create();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
    DB::table('sessions')->insert(['id' => 'autre-appareil', 'user_id' => $user->id, 'payload' => 'x', 'last_activity' => time()]);

    $user->forceFill(['is_active' => false])->save();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);

    // Nouvelle requête : la garde relit l'utilisateur depuis la session.
    nextRequest();
    $this->getJson('/api/v1/auth/user')->assertUnauthorized();
});

it('expire la session admin/editor après 30 minutes d\'inactivité', function (string $role) {
    $staff = User::factory()->role($role)->create();
    $this->postJson('/api/v1/auth/login', loginPayload($staff))->assertOk();

    $this->travel(29)->minutes();
    nextRequest();
    $this->getJson('/api/v1/auth/user')->assertOk();

    $this->travel(29)->minutes();
    nextRequest();
    $this->getJson('/api/v1/auth/user')->assertOk();

    $this->travel(31)->minutes();
    nextRequest();
    $this->getJson('/api/v1/auth/user')->assertUnauthorized();
    $this->assertGuest('web');
})->with(['admin', 'editor']);

it('n\'applique pas l\'expiration staff aux autres rôles', function (string $role) {
    $user = User::factory()->role($role)->create();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();

    $this->travel(45)->minutes();
    nextRequest();

    $this->getJson('/api/v1/auth/user')->assertOk();
})->with(['user', 'provider']);

describe('middleware 2fa.staff', function () {
    beforeEach(function () {
        Route::middleware(['api', 'auth:sanctum', '2fa.staff'])
            ->get('/api/v1/__test/admin-zone', fn () => response()->json(['ok' => true]));
    });

    it('refuse un admin/editor sans 2FA confirmée', function (string $role) {
        $this->actingAs(User::factory()->role($role)->create());

        $this->getJson('/api/v1/__test/admin-zone')
            ->assertForbidden()
            ->assertExactJson(['message' => 'Veuillez activer la double authentification pour accéder à cet espace.']);
    })->with(['admin', 'editor']);

    it('accepte un admin avec 2FA confirmée', function () {
        [$admin] = userWithTwoFactor(User::factory()->admin());
        $this->actingAs($admin);

        $this->getJson('/api/v1/__test/admin-zone')->assertOk();
    });

    it('n\'impose rien aux rôles non staff et refuse les anonymes', function () {
        $this->getJson('/api/v1/__test/admin-zone')->assertUnauthorized();

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/__test/admin-zone')->assertOk();
    });

    it('refuse un admin avec 2FA activée mais non validée à la connexion', function () {
        [$admin] = userWithTwoFactor(User::factory()->admin());

        $this->postJson('/api/v1/auth/login', loginPayload($admin))->assertExactJson(['two_factor' => true]);

        $this->getJson('/api/v1/__test/admin-zone')->assertUnauthorized();
    });
});
