<?php

use App\Models\User;
use Illuminate\Support\Facades\Gate;

it('applique la matrice d\'autorisation des comptes', function () {
    $admin = User::factory()->admin()->create();
    $otherAdmin = User::factory()->admin()->create();
    $editor = User::factory()->editor()->create();
    $provider = User::factory()->provider()->create();
    $user = User::factory()->create();
    $other = User::factory()->create();

    // Lister : admin uniquement.
    expect(Gate::forUser($admin)->allows('viewAny', User::class))->toBeTrue();
    foreach ([$editor, $provider, $user] as $actor) {
        expect(Gate::forUser($actor)->allows('viewAny', User::class))->toBeFalse();
    }

    // Voir / modifier : soi-même ou admin.
    foreach (['view', 'update'] as $ability) {
        expect(Gate::forUser($user)->allows($ability, $user))->toBeTrue();
        expect(Gate::forUser($user)->allows($ability, $other))->toBeFalse();
        expect(Gate::forUser($editor)->allows($ability, $user))->toBeFalse();
        expect(Gate::forUser($provider)->allows($ability, $user))->toBeFalse();
        expect(Gate::forUser($admin)->allows($ability, $user))->toBeTrue();
    }

    // Rôle / statut : admin uniquement, jamais sur soi-même.
    foreach (['changeRole', 'changeStatus'] as $ability) {
        expect(Gate::forUser($admin)->allows($ability, $user))->toBeTrue();
        expect(Gate::forUser($admin)->allows($ability, $otherAdmin))->toBeTrue();
        expect(Gate::forUser($admin)->allows($ability, $admin))->toBeFalse();
        expect(Gate::forUser($editor)->allows($ability, $user))->toBeFalse();
        expect(Gate::forUser($user)->allows($ability, $user))->toBeFalse();
    }
});
