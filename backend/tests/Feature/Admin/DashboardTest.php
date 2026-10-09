<?php

use App\Models\AuditLog;
use App\Models\City;
use App\Models\Provider;
use App\Models\StateForce;
use App\Models\User;
use Illuminate\Support\Facades\DB;

const DASHBOARD_URL = '/api/v1/admin/dashboard';

it('refuse le tableau de bord à un anonyme (401) et aux rôles non administrateurs (403)', function () {
    $this->getJson(DASHBOARD_URL)->assertUnauthorized();

    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor()] as $user) {
        $this->actingAs($user)->getJson(DASHBOARD_URL)->assertForbidden();
    }
});

it('refuse un administrateur sans 2FA confirmée (403)', function () {
    $this->actingAs(User::factory()->admin()->create())->getJson(DASHBOARD_URL)->assertForbidden();
});

it('renvoie les compteurs hors fiches supprimées et les 10 derniers événements', function () {
    $admin = makeAdmin();
    $city = City::factory()->create();
    Provider::factory()->pending()->create(['city_id' => $city->id]);
    Provider::factory()->pending()->create(['city_id' => $city->id])->delete();
    makeProvider([], $city);
    StateForce::factory()->pending()->create(['city_id' => $city->id]);
    makeStateForce([], $city);
    makeStateForce([], $city);

    $pending = Provider::factory()->pending()->create(['city_id' => $city->id]);
    DB::table('provider_change_requests')->insert([
        'provider_id' => $pending->id, 'changes' => '{}', 'status' => 'pending',
    ]);
    $other = makeProvider([], $city);
    DB::table('provider_change_requests')->insert([
        'provider_id' => $other->id, 'changes' => '{}', 'status' => 'approved',
    ]);

    foreach (range(1, 12) as $i) {
        AuditLog::create(['event' => 'test_event_'.$i, 'user_id' => $admin->id]);
    }

    $data = $this->actingAs($admin)->getJson(DASHBOARD_URL)->assertOk()->json('data');

    expect($data)->toMatchArray([
        'pending_providers' => 2,
        'pending_state_forces' => 1,
        'pending_change_requests' => 1,
        'users_total' => 1,
        'providers_approved' => 2,
        'state_forces_approved' => 2,
    ]);
    expect($data['recent_audit'])->toHaveCount(10);
    expect($data['recent_audit'][0])->toHaveKeys(['id', 'event', 'user', 'auditable_type', 'auditable_id', 'old_values', 'new_values', 'ip_address', 'created_at']);
    expect($data['recent_audit'][0]['event'])->toBe('test_event_12');
    expect($data['recent_audit'][0]['user'])->toBe(['id' => $admin->id, 'name' => $admin->first_name.' '.$admin->last_name]);
});
