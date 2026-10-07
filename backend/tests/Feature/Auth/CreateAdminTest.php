<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

function runCreateAdmin(string $email, string $password, ?string $confirmation = null)
{
    return test()->artisan('app:create-admin')
        ->expectsQuestion('Prénom', 'Mariam')
        ->expectsQuestion('Nom', 'Traoré')
        ->expectsQuestion('Adresse e-mail', $email)
        ->expectsQuestion('Mot de passe (12 caractères minimum)', $password)
        ->expectsQuestion('Confirmez le mot de passe', $confirmation ?? $password);
}

it('crée un administrateur vérifié et journalise sans le mot de passe', function () {
    runCreateAdmin('Admin@Example.com', 'Super-Secret-2026')->assertSuccessful();

    $admin = User::where('email', 'admin@example.com')->firstOrFail();
    expect($admin->role)->toBe('admin')
        ->and($admin->is_active)->toBeTrue()
        ->and($admin->email_verified_at)->not->toBeNull()
        ->and($admin->hasTwoFactorEnabled())->toBeFalse()
        ->and(Hash::check('Super-Secret-2026', $admin->password))->toBeTrue();

    $log = AuditLog::where('event', 'admin_created')->firstOrFail();
    expect($log->auditable_id)->toBe($admin->id)
        ->and(json_encode($log->toArray()))->not->toContain('Super-Secret-2026');
});

it('refuse un email existant', function () {
    User::factory()->create(['email' => 'admin@example.com']);

    runCreateAdmin('admin@example.com', 'Super-Secret-2026')->assertFailed();
    expect(User::where('role', 'admin')->count())->toBe(0);
});

it('refuse un mot de passe trop court ou mal confirmé', function () {
    runCreateAdmin('a1@example.com', 'Court-2026')->assertFailed();
    runCreateAdmin('a2@example.com', 'Super-Secret-2026', 'Autre-Secret-2026')->assertFailed();

    expect(User::count())->toBe(0);
});

it('n\'accepte aucun argument ni option', function () {
    $definition = Artisan::all()['app:create-admin']->getDefinition();

    expect($definition->getArguments())->toBeEmpty();
    expect(array_keys($definition->getOptions()))->not->toContain('password')->not->toContain('email');
});
