<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Services\Admin\UserAdministration;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

const USERS_URL = '/api/v1/admin/users';

function addSession(User $user, string $id): void
{
    DB::table('sessions')->insert([
        'id' => $id, 'user_id' => $user->id, 'ip_address' => '127.0.0.1', 'user_agent' => 'test',
        'payload' => 'x', 'last_activity' => time(),
    ]);
}

it('refuse tous les accès sans droits suffisants (401 / 403)', function () {
    $target = User::factory()->create();
    $calls = [
        ['getJson', USERS_URL, []],
        ['getJson', USERS_URL.'/'.$target->id, []],
        ['patchJson', USERS_URL.'/'.$target->id, ['role' => 'editor']],
        ['postJson', USERS_URL.'/'.$target->id.'/anonymize', ['confirm_email' => $target->email]],
    ];

    foreach ($calls as [$method, $url, $body]) {
        $this->{$method}($url, $body)->assertUnauthorized();
    }
    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $user) {
        foreach ($calls as [$method, $url, $body]) {
            $this->actingAs($user)->{$method}($url, $body)->assertForbidden();
        }
    }
    expect($target->refresh()->role)->toBe('user');
});

it('liste les comptes avec le format AdminUser et le nombre d\'établissements', function () {
    $admin = makeAdmin();
    $owner = User::factory()->provider()->create(['last_login_at' => now()]);
    makeProvider(['user_id' => $owner->id]);
    makeProvider(['user_id' => $owner->id])->delete();
    makeStateForce(['user_id' => $owner->id]);

    $json = $this->actingAs($admin)->getJson(USERS_URL.'?role=provider')->assertOk()->json();

    expect($json['data'])->toHaveCount(1);
    expect($json['data'][0])->toMatchArray([
        'id' => $owner->id, 'email' => $owner->email, 'role' => 'provider', 'is_active' => true,
        'email_verified' => true, 'two_factor_enabled' => false, 'establishments_count' => 2,
    ]);
    expect($json['data'][0])->toHaveKeys(['first_name', 'last_name', 'phone', 'last_login_at', 'created_at']);
    expect($json['data'][0])->not->toHaveKeys(['password', 'two_factor_secret', 'remember_token']);
    expect($json['meta']['total'])->toBe(1);
});

it('filtre par recherche (échappement des jokers), statut et pagination', function () {
    $admin = makeAdmin();
    User::factory()->create(['first_name' => 'Aminata', 'last_name' => 'Koné', 'email' => 'aminata@example.test']);
    User::factory()->create(['first_name' => 'Zoé', 'last_name' => 'Traoré', 'email' => 'zoe@example.test', 'is_active' => false]);
    User::factory()->create(['first_name' => 'Jean', 'last_name' => '100%Pur', 'email' => 'jean@example.test']);

    $names = fn (string $qs) => collect($this->actingAs($admin)->getJson(USERS_URL.'?'.$qs)->assertOk()->json('data'))->pluck('first_name')->sort()->values()->all();

    expect($names('q=amina'))->toBe(['Aminata']);
    expect($names('q=ZOE@EXAMPLE'))->toBe(['Zoé']);
    expect($names('q=Aminata+Koné'))->toBe(['Aminata']);
    expect($names('q=100%25'))->toBe(['Jean']);
    expect($names('q=%25'))->toBe(['Jean']);
    expect($names('q=_'))->toBe([]);
    expect($names('is_active=0'))->toBe(['Zoé']);

    $page = $this->actingAs($admin)->getJson(USERS_URL.'?per_page=2&page=2')->assertOk()->json();
    expect($page['data'])->toHaveCount(2)->and($page['meta']['total'])->toBe(4);
});

it('valide les paramètres de liste', function () {
    $this->actingAs(makeAdmin());
    $this->getJson(USERS_URL.'?per_page=51')->assertUnprocessable()->assertJsonValidationErrors('per_page');
    $this->getJson(USERS_URL.'?role=root')->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->getJson(USERS_URL.'?is_active=peut-etre')->assertUnprocessable()->assertJsonValidationErrors('is_active');
});

it('affiche un compte et renvoie 404 pour un compte inconnu ou supprimé', function () {
    $admin = makeAdmin();
    $user = User::factory()->create();
    $gone = User::factory()->create();
    $gone->delete();

    $this->actingAs($admin)->getJson(USERS_URL.'/'.$user->id)->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.establishments_count', 0);
    $this->getJson(USERS_URL.'/999999')->assertNotFound();
    $this->getJson(USERS_URL.'/'.$gone->id)->assertNotFound();
});

it('change le rôle : audit avec l\'administrateur comme acteur, sessions de la cible détruites', function () {
    $admin = makeAdmin();
    $user = User::factory()->create();
    $bystander = User::factory()->create();
    addSession($user, 'sess-target');
    addSession($bystander, 'sess-other');

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$user->id, ['role' => 'editor'])
        ->assertOk()->assertJsonPath('data.role', 'editor');

    expect($user->refresh()->role)->toBe('editor');
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
    expect(DB::table('sessions')->where('user_id', $bystander->id)->count())->toBe(1);

    $logs = AuditLog::where('event', 'role_changed')->get();
    expect($logs)->toHaveCount(1);
    expect($logs[0]->user_id)->toBe($admin->id);
    expect($logs[0]->auditable_id)->toBe($user->id);
    expect($logs[0]->old_values)->toBe(['role' => 'user'])->and($logs[0]->new_values)->toBe(['role' => 'editor']);
});

it('désactive et réactive un compte avec audit account_status_changed', function () {
    $admin = makeAdmin();
    $user = User::factory()->provider()->create();
    addSession($user, 'sess-1');

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$user->id, ['is_active' => false])
        ->assertOk()->assertJsonPath('data.is_active', false);
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);

    $this->patchJson(USERS_URL.'/'.$user->id, ['is_active' => true])->assertOk()->assertJsonPath('data.is_active', true);

    $logs = AuditLog::where('event', 'account_status_changed')->orderBy('id')->get();
    expect($logs)->toHaveCount(2);
    expect($logs->pluck('user_id')->unique()->all())->toBe([$admin->id]);
});

it('ignore les champs hors liste blanche', function () {
    $admin = makeAdmin();
    $user = User::factory()->create(['email' => 'cible@example.test']);
    $hash = $user->password;

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$user->id, [
        'role' => 'provider', 'email' => 'pirate@example.test', 'password' => 'Hack-12345678!',
        'first_name' => 'Pirate', 'email_verified_at' => null, 'id' => 999, 'two_factor_secret' => 'x',
    ])->assertOk();

    $user->refresh();
    expect($user->role)->toBe('provider')
        ->and((string) $user->email)->toBe('cible@example.test')
        ->and($user->password)->toBe($hash)
        ->and($user->first_name)->not->toBe('Pirate')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('valide la modification : rôle inconnu, corps vide, statut non booléen', function () {
    $this->actingAs(makeAdmin());
    $user = User::factory()->create();

    $this->patchJson(USERS_URL.'/'.$user->id, ['role' => 'superman'])->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->patchJson(USERS_URL.'/'.$user->id, [])->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->patchJson(USERS_URL.'/'.$user->id, ['is_active' => 'peut-etre'])->assertUnprocessable()->assertJsonValidationErrors('is_active');
    $this->patchJson(USERS_URL.'/999999', ['role' => 'user'])->assertNotFound();
});

it('refuse l\'auto-rétrogradation et l\'auto-désactivation (422)', function () {
    $admin = makeAdmin();
    makeAdmin(); // un autre administrateur actif existe : la règle vise bien « soi-même »

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$admin->id, ['role' => 'user'])
        ->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->patchJson(USERS_URL.'/'.$admin->id, ['is_active' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('is_active');

    expect($admin->refresh()->role)->toBe('admin')->and($admin->is_active)->toBeTrue();
    expect(AuditLog::where('event', 'role_changed')->count())->toBe(0);
});

it('rétrograde un autre administrateur tant qu\'il en reste un', function () {
    $admin = makeAdmin();
    $other = makeAdmin();

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$other->id, ['role' => 'user'])->assertOk()->assertJsonPath('data.role', 'user');
});

it('refuse admin/éditeur pour un compte désactivé ou non vérifié', function () {
    $admin = makeAdmin();
    $inactive = User::factory()->inactive()->create();
    $unverified = User::factory()->unverified()->create();

    $this->actingAs($admin)->patchJson(USERS_URL.'/'.$inactive->id, ['role' => 'admin'])->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->patchJson(USERS_URL.'/'.$unverified->id, ['role' => 'editor'])->assertUnprocessable()->assertJsonValidationErrors('role');
    // Désactiver ET promouvoir dans la même requête est refusé aussi.
    $user = User::factory()->create();
    $this->patchJson(USERS_URL.'/'.$user->id, ['role' => 'admin', 'is_active' => false])->assertUnprocessable()->assertJsonValidationErrors('role');
    expect($user->refresh()->role)->toBe('user');
});

it('protège le dernier administrateur actif (service, acteur non administrateur)', function () {
    $last = makeAdmin();
    $inactiveAdmin = User::factory()->admin()->inactive()->create();
    $service = app(UserAdministration::class);

    foreach ([['role' => 'user'], ['is_active' => false]] as $change) {
        expect(fn () => $service->update($inactiveAdmin, $last->id, $change))->toThrow(ValidationException::class);
    }
    expect(fn () => $service->anonymize($inactiveAdmin, $last->id, (string) $last->email))->toThrow(ValidationException::class);

    expect($last->refresh()->role)->toBe('admin')->and($last->is_active)->toBeTrue();
});

it('anonymise : mauvaise confirmation refusée, bonne confirmation insensible à la casse', function () {
    $admin = makeAdmin();
    $user = User::factory()->create(['email' => 'Victime@Example.test']);
    addSession($user, 'sess-anon');
    $url = USERS_URL.'/'.$user->id.'/anonymize';

    $this->actingAs($admin)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('confirm_email');
    $this->postJson($url, ['confirm_email' => 'autre@example.test'])->assertUnprocessable()->assertJsonValidationErrors('confirm_email');
    expect(User::find($user->id))->not->toBeNull();

    $this->postJson($url, ['confirm_email' => ' victime@EXAMPLE.test '])->assertNoContent();

    $row = User::withTrashed()->find($user->id);
    expect((string) $row->email)->toBe('anonymise-'.$user->id.'@anonymise.invalid')
        ->and($row->trashed())->toBeTrue()
        ->and($row->is_active)->toBeFalse();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);

    $log = AuditLog::where('event', 'user_anonymized_by_admin')->sole();
    expect($log->user_id)->toBe($admin->id)->and($log->auditable_id)->toBe($user->id);
    expect(json_encode($log->toArray()))->not->toContain('victime')->not->toContain('Victime');

    // Compte désormais supprimé : introuvable.
    $this->postJson($url, ['confirm_email' => 'x@example.test'])->assertNotFound();
});

it('refuse d\'anonymiser son propre compte ou un compte déjà anonymisé', function () {
    $admin = makeAdmin();
    makeAdmin();

    $this->actingAs($admin)->postJson(USERS_URL.'/'.$admin->id.'/anonymize', ['confirm_email' => $admin->email])
        ->assertUnprocessable()->assertJsonValidationErrors('confirm_email');
    expect(User::find($admin->id))->not->toBeNull();

    $done = User::factory()->create();
    DB::statement('CALL sp_anonymize_user(?)', [$done->id]);
    $anonymized = (string) User::withTrashed()->find($done->id)->email;
    expect(fn () => app(UserAdministration::class)->anonymize($admin, $done->id, $anonymized))->toThrow(ValidationException::class);
});
