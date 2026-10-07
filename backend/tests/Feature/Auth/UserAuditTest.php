<?php

use App\Models\AuditLog;
use App\Models\User;

it('journalise les changements de rôle avec ancienne et nouvelle valeur', function () {
    $admin = User::factory()->admin()->create();
    $user = User::factory()->create();
    $this->actingAs($admin);

    $user->forceFill(['role' => 'provider'])->save();

    $log = AuditLog::where('event', 'role_changed')->firstOrFail();
    expect($log->auditable_id)->toBe($user->id)
        ->and($log->user_id)->toBe($admin->id)
        ->and($log->old_values)->toBe(['role' => 'user'])
        ->and($log->new_values)->toBe(['role' => 'provider']);
});

it('journalise les changements de statut', function () {
    $user = User::factory()->create();

    $user->forceFill(['is_active' => false])->save();

    $log = AuditLog::where('event', 'account_status_changed')->firstOrFail();
    expect($log->old_values)->toBe(['is_active' => true])
        ->and($log->new_values)->toBe(['is_active' => false]);
});

it('ne journalise rien pour une modification ordinaire', function () {
    $user = User::factory()->create();

    $user->forceFill(['first_name' => 'Nouveau'])->save();

    expect(AuditLog::whereIn('event', ['role_changed', 'account_status_changed'])->count())->toBe(0);
});
