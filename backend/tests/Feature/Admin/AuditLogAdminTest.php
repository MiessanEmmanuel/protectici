<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

const AUDIT_URL = '/api/v1/admin/audit-logs';

it('refuse l\'accès au journal sans droits (401 / 403)', function () {
    $this->getJson(AUDIT_URL)->assertUnauthorized();
    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $user) {
        $this->actingAs($user)->getJson(AUDIT_URL)->assertForbidden();
    }
});

it('liste le journal, plus récent d\'abord, avec valeurs filtrées et utilisateur chargé', function () {
    $admin = makeAdmin();
    AuditLog::create(['event' => 'first', 'user_id' => $admin->id]);
    AuditLog::create([
        'event' => 'second', 'user_id' => $admin->id, 'auditable_type' => 'user', 'auditable_id' => $admin->id,
        // Insertion directe : simule une valeur sensible présente en base malgré AuditLogger.
        'old_values' => ['role' => 'user', 'api_token' => 'xxx', 'nested' => ['Password' => 'p', 'ok' => 1]],
        'new_values' => ['role' => 'admin'],
    ]);

    $json = $this->actingAs($admin)->getJson(AUDIT_URL)->assertOk()->json();

    expect($json['data'][0]['event'])->toBe('second');
    expect($json['data'][0]['old_values'])->toBe(['role' => 'user', 'nested' => ['ok' => 1]]);
    expect($json['data'][0]['user']['id'])->toBe($admin->id);
    expect($json['data'][0])->not->toHaveKeys(['context', 'user_agent']);
    expect($json['meta'])->toHaveKeys(['current_page', 'last_page', 'per_page', 'total']);
    expect($json['meta']['total'])->toBe(2);
});

it('filtre par événement, utilisateur et type d\'objet', function () {
    $admin = makeAdmin();
    $other = User::factory()->create();
    AuditLog::create(['event' => 'role_changed', 'user_id' => $admin->id, 'auditable_type' => 'user', 'auditable_id' => 1]);
    AuditLog::create(['event' => 'reference_created', 'user_id' => $other->id, 'auditable_type' => 'provider', 'auditable_id' => 2]);

    $get = fn (string $qs) => collect($this->actingAs($admin)->getJson(AUDIT_URL.'?'.$qs)->assertOk()->json('data'))->pluck('event')->all();

    expect($get('event=role_changed'))->toBe(['role_changed']);
    expect($get('user_id='.$other->id))->toBe(['reference_created']);
    expect($get('auditable_type=provider'))->toBe(['reference_created']);
    expect($get('event=role_changed&user_id='.$other->id))->toBe([]);
});

it('filtre par période avec bornes inclusives (date seule = journée entière)', function () {
    $admin = makeAdmin();
    foreach (['2026-01-09 12:00:00' => 'before', '2026-01-10 00:00:00' => 'start', '2026-01-10 23:59:59' => 'end_of_day', '2026-01-11 00:00:00' => 'after'] as $date => $event) {
        DB::table('audit_logs')->insert(['event' => $event, 'user_id' => $admin->id, 'created_at' => $date.'+00']);
    }

    $events = collect($this->actingAs($admin)->getJson(AUDIT_URL.'?from=2026-01-10&to=2026-01-10')->assertOk()->json('data'))
        ->pluck('event')->sort()->values()->all();

    expect($events)->toBe(['end_of_day', 'start']);

    $withTime = collect($this->actingAs($admin)->getJson(AUDIT_URL.'?to=2026-01-10T00:00:00Z')->assertOk()->json('data'))
        ->pluck('event')->sort()->values()->all();
    expect($withTime)->toBe(['before', 'start']);
});

it('valide les filtres : type hors liste blanche, dates, pagination', function () {
    $admin = makeAdmin();
    $this->actingAs($admin);

    $this->getJson(AUDIT_URL.'?auditable_type=App\\Models\\User')->assertUnprocessable()->assertJsonValidationErrors('auditable_type');
    $this->getJson(AUDIT_URL.'?from=hier')->assertUnprocessable()->assertJsonValidationErrors('from');
    $this->getJson(AUDIT_URL.'?from=2026-02-01&to=2026-01-01')->assertUnprocessable()->assertJsonValidationErrors('to');
    $this->getJson(AUDIT_URL.'?per_page=51')->assertUnprocessable()->assertJsonValidationErrors('per_page');
    $this->getJson(AUDIT_URL.'?user_id=abc')->assertUnprocessable()->assertJsonValidationErrors('user_id');
});
