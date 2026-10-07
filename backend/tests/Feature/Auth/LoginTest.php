<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Factories\UserFactory;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
});

it('connecte un utilisateur et renvoie l\'objet User du contrat', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/v1/auth/login', loginPayload($user));

    $response->assertOk()
        ->assertExactJsonStructure(['data' => ['id', 'first_name', 'last_name', 'email', 'phone', 'role', 'email_verified', 'two_factor_enabled', 'created_at']])
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.role', 'user')
        ->assertJsonPath('data.email_verified', true)
        ->assertJsonPath('data.two_factor_enabled', false);
    expect($response->json('data.created_at'))->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/');

    $this->assertAuthenticatedAs($user, 'web');
    expect($user->fresh()->last_login_at)->not->toBeNull();
    expect(AuditLog::where('event', 'login_succeeded')->where('auditable_id', $user->id)->exists())->toBeTrue();
});

it('accepte l\'email sans tenir compte de la casse', function () {
    $user = User::factory()->create(['email' => 'awa.kone@example.com']);

    $this->postJson('/api/v1/auth/login', ['email' => 'AWA.Kone@Example.com', 'password' => UserFactory::TEST_PASSWORD])
        ->assertOk();
});

it('régénère l\'identifiant de session à la connexion', function () {
    $user = User::factory()->create();
    $this->get('/sanctum/csrf-cookie')->assertNoContent();
    $before = app('session.store')->getId();

    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();

    expect(app('session.store')->getId())->not->toBe($before);
});

it('valide les champs de connexion', function () {
    $this->postJson('/api/v1/auth/login', ['email' => 'pas-un-email'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password']);
});

it('renvoie le même message générique pour compte inconnu, mauvais mot de passe et compte inactif', function () {
    $user = User::factory()->create();
    $inactive = User::factory()->inactive()->create();

    $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@example.com', 'password' => 'Nimporte-Quoi-123']);
    $wrong = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Mauvais-Mot-De-Passe']);
    $disabled = $this->postJson('/api/v1/auth/login', loginPayload($inactive));

    foreach ([$unknown, $wrong, $disabled] as $response) {
        $response->assertStatus(422)->assertExactJson([
            'message' => 'Les données fournies sont invalides.',
            'errors' => ['email' => ['Ces identifiants ne correspondent à aucun compte.']],
        ]);
    }
    $this->assertGuest('web');
});

it('renvoie two_factor: true sans authentifier quand la 2FA est confirmée', function () {
    [$user] = userWithTwoFactor();

    $this->postJson('/api/v1/auth/login', loginPayload($user))
        ->assertOk()
        ->assertExactJson(['two_factor' => true]);

    $this->assertGuest('web');
    $this->getJson('/api/v1/auth/user')->assertUnauthorized();
});

it('limite la connexion à 5 tentatives par minute avec Retry-After', function () {
    $user = User::factory()->create();

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Mauvais-'.$i])->assertStatus(422);
    }

    $response = $this->postJson('/api/v1/auth/login', loginPayload($user));
    $response->assertStatus(429)->assertExactJson(['message' => 'Trop de requêtes. Veuillez réessayer plus tard.']);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);
});

it('applique un verrouillage progressif et alerte après 10 échecs', function () {
    $user = User::factory()->create();
    $fail = fn () => $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Mauvais-mot-de-passe']);

    foreach (range(1, 5) as $i) {
        $fail()->assertStatus(422);
    }
    $fail()->assertStatus(429);

    $this->travel(61)->seconds();
    foreach (range(1, 5) as $i) {
        $fail()->assertStatus(422);
    }

    // Le limiteur par minute est écoulé : seul le verrouillage de 5 minutes s'applique.
    $this->travel(61)->seconds();
    $locked = $this->postJson('/api/v1/auth/login', loginPayload($user));
    $locked->assertStatus(429);
    expect((int) $locked->headers->get('Retry-After'))->toBeGreaterThan(60)->toBeLessThanOrEqual(300);

    expect(AuditLog::where('event', 'login_failures_alert')->count())->toBe(1);

    // Fin du verrouillage : connexion possible avec le bon mot de passe.
    $this->travel(5)->minutes();
    $this->postJson('/api/v1/auth/login', loginPayload($user))->assertOk();
});

it('limite les comptes admin/editor à 3 tentatives par minute sans le révéler dans les en-têtes', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();

    foreach (range(1, 3) as $i) {
        $response = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Mauvais-'.$i]);
        $response->assertStatus(422);
        $response->assertHeader('X-RateLimit-Limit', '5');
    }
    $this->postJson('/api/v1/auth/login', loginPayload($admin))->assertStatus(429);

    foreach (range(1, 4) as $i) {
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Mauvais-'.$i])
            ->assertStatus(422)
            ->assertHeader('X-RateLimit-Limit', '5');
    }

    expect(AuditLog::where('event', 'login_failed')->where('auditable_id', $admin->id)->count())->toBe(3);
});

it('ignore « se souvenir de moi » pour le staff', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();

    $this->postJson('/api/v1/auth/login', loginPayload($admin, ['remember' => true]))
        ->assertOk()
        ->assertCookieMissing(auth()->guard('web')->getRecallerName());
    expect($admin->fresh()->getRememberToken())->toBeEmpty();

    $this->postJson('/api/v1/auth/logout')->assertNoContent();

    $response = $this->postJson('/api/v1/auth/login', loginPayload($user, ['remember' => true]))->assertOk();
    expect($user->fresh()->getRememberToken())->not->toBeEmpty();
    $response->assertCookie(auth()->guard('web')->getRecallerName());
});

it('stocke les mots de passe en Argon2id', function () {
    $user = User::factory()->create();

    $raw = DB::table('users')->where('id', $user->id)->value('password');

    expect($raw)->toStartWith('$argon2id$');
});
