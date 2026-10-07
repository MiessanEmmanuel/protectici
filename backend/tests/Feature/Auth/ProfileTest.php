<?php

use App\Models\User;

require_once __DIR__.'/Helpers.php';

beforeEach(function () {
    $this->withHeaders($this->spaHeaders());
});

it('met à jour le prénom, le nom et le téléphone normalisé', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->patchJson('/api/v1/auth/profile', [
        'first_name' => 'Koffi',
        'last_name' => 'Yao',
        'phone' => '+225 05 06 07 08 09',
    ])->assertOk()
        ->assertJsonPath('data.first_name', 'Koffi')
        ->assertJsonPath('data.last_name', 'Yao')
        ->assertJsonPath('data.phone', '+2250506070809');
});

it('accepte une mise à jour partielle et la suppression du téléphone', function () {
    $user = User::factory()->create(['first_name' => 'Awa', 'phone' => '+2250102030405']);
    $this->actingAs($user);

    $this->patchJson('/api/v1/auth/profile', ['phone' => null])
        ->assertOk()
        ->assertJsonPath('data.first_name', 'Awa')
        ->assertJsonPath('data.phone', null);
});

it('ignore role, is_active, email et tout champ inconnu', function () {
    $user = User::factory()->create(['email' => 'awa@example.com']);
    $this->actingAs($user);

    $this->patchJson('/api/v1/auth/profile', [
        'first_name' => 'Awa',
        'role' => 'admin',
        'is_active' => false,
        'email' => 'pirate@example.com',
        'email_verified_at' => null,
        'two_factor_confirmed_at' => now()->toIso8601String(),
    ])->assertOk()->assertJsonPath('data.role', 'user');

    $fresh = $user->fresh();
    expect($fresh->role)->toBe('user')
        ->and($fresh->is_active)->toBeTrue()
        ->and($fresh->email)->toBe('awa@example.com')
        ->and($fresh->email_verified_at)->not->toBeNull()
        ->and($fresh->two_factor_confirmed_at)->toBeNull();
});

it('valide le profil', function () {
    $this->actingAs(User::factory()->create());

    $this->patchJson('/api/v1/auth/profile', ['first_name' => '', 'last_name' => str_repeat('a', 101), 'phone' => 'abc'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['first_name', 'last_name', 'phone']);
});

it('exige une authentification', function () {
    $this->patchJson('/api/v1/auth/profile', ['first_name' => 'X'])->assertUnauthorized();
});
