<?php

use App\Models\User;
use App\Notifications\Admin\AdminAlert;

const NOTIF_URL = '/api/v1/admin/notifications';

function alert(User $admin, string $title = 'Nouvelle fiche'): string
{
    $admin->notify(new AdminAlert(AdminAlert::KIND_ESTABLISHMENT_SUBMITTED, $title, 'Une fiche attend validation.', ['type' => 'provider', 'id' => 7, 'name' => 'Sentinelle']));

    return (string) $admin->notifications()->latest('created_at')->latest('id')->firstOrFail()->id;
}

it('refuse l\'accès sans droits suffisants (401 / 403)', function () {
    $id = alert(makeAdmin());
    $this->getJson(NOTIF_URL)->assertUnauthorized();
    $this->postJson(NOTIF_URL.'/'.$id.'/read')->assertUnauthorized();

    foreach ([User::factory()->create(), User::factory()->provider()->create(), makeEditor(), User::factory()->admin()->create()] as $user) {
        $this->actingAs($user)->getJson(NOTIF_URL)->assertForbidden();
        $this->actingAs($user)->postJson(NOTIF_URL.'/'.$id.'/read')->assertForbidden();
    }
});

it('liste uniquement les notifications de l\'administrateur connecté, récentes d\'abord, avec le nombre de non lues', function () {
    $admin = makeAdmin();
    $other = makeAdmin();
    alert($admin, 'Première');
    $this->travel(1)->minute();
    $secondId = alert($admin, 'Seconde');
    alert($other, 'Pour l\'autre');
    $admin->notifications()->whereKey($secondId)->first()->markAsRead();

    $json = $this->actingAs($admin)->getJson(NOTIF_URL)->assertOk()->json();

    expect($json['data'])->toHaveCount(2);
    expect($json['data'][0])->toHaveKeys(['id', 'kind', 'title', 'message', 'establishment', 'read_at', 'created_at']);
    expect($json['data'][0]['title'])->toBe('Seconde')->and($json['data'][0]['read_at'])->not->toBeNull();
    expect($json['data'][1]['title'])->toBe('Première')->and($json['data'][1]['read_at'])->toBeNull();
    expect($json['data'][1]['kind'])->toBe('establishment_submitted');
    expect($json['data'][1]['establishment'])->toMatchArray(['type' => 'provider', 'id' => 7]);
    expect($json['meta'])->toMatchArray(['total' => 2, 'unread_count' => 1]);
    expect(json_encode($json))->not->toContain('Pour l\'autre');
});

it('valide la pagination des notifications', function () {
    $this->actingAs(makeAdmin());
    $this->getJson(NOTIF_URL.'?per_page=51')->assertUnprocessable()->assertJsonValidationErrors('per_page');
    $this->getJson(NOTIF_URL.'?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
});

it('marque une notification comme lue, de façon idempotente', function () {
    $admin = makeAdmin();
    $id = alert($admin);

    $first = $this->actingAs($admin)->postJson(NOTIF_URL.'/'.$id.'/read')->assertOk()->assertJsonPath('data.id', $id)->json('data');
    expect($first['read_at'])->not->toBeNull();

    $second = $this->postJson(NOTIF_URL.'/'.$id.'/read')->assertOk()->json('data');
    expect($second['read_at'])->toBe($first['read_at']);
    expect($this->getJson(NOTIF_URL)->json('meta.unread_count'))->toBe(0);
});

it('renvoie 404 pour la notification d\'un autre administrateur ou inexistante', function () {
    $admin = makeAdmin();
    $other = makeAdmin();
    $otherId = alert($other);

    $this->actingAs($admin)->postJson(NOTIF_URL.'/'.$otherId.'/read')->assertNotFound();
    $this->postJson(NOTIF_URL.'/'.fake()->uuid().'/read')->assertNotFound();
    $this->postJson(NOTIF_URL.'/pas-un-uuid/read')->assertNotFound();
    expect($other->notifications()->first()->read_at)->toBeNull();
});
