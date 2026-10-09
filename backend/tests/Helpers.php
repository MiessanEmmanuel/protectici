<?php

use App\Models\City;
use App\Models\CompanyType;
use App\Models\Provider;
use App\Models\ServiceType;
use App\Models\StateForce;
use App\Models\StateForceType;
use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

const SUMMARY_KEYS = ['slug', 'name', 'logo_url', 'city', 'district', 'phone', 'services', 'price_from', 'rating_avg', 'rating_count', 'is_verified', 'is_featured', 'lat', 'lng', 'distance_m'];

/** Fiche publique par défaut (approuvée + visible), rattachée à une ville existante si fournie. */
function makeProvider(array $attributes = [], ?City $city = null): Provider
{
    return Provider::factory()->create($attributes + ['city_id' => $city?->id ?? City::factory()->create()->id]);
}

function makeStateForce(array $attributes = [], ?City $city = null): StateForce
{
    return StateForce::factory()->create($attributes + ['city_id' => $city?->id ?? City::factory()->create()->id]);
}

/**
 * Administrateur de test avec 2FA confirmée (obligatoire pour /admin/*, middleware 2fa.staff).
 * Les routes d'administration sont appelées avec ->actingAs($admin).
 */
function makeAdmin(array $attributes = []): User
{
    $admin = User::factory()->admin()->create($attributes);
    $admin->forceFill([
        'two_factor_secret' => (new Google2FA)->generateSecretKey(32),
        'two_factor_recovery_codes' => ['aaaaa-11111'],
        'two_factor_confirmed_at' => now(),
    ])->save();

    return $admin->refresh();
}

/** Éditeur avec 2FA (n'a AUCUN accès à /admin/*). */
function makeEditor(): User
{
    $editor = User::factory()->editor()->create();
    $editor->forceFill([
        'two_factor_secret' => (new Google2FA)->generateSecretKey(32),
        'two_factor_recovery_codes' => ['aaaaa-11111'],
        'two_factor_confirmed_at' => now(),
    ])->save();

    return $editor->refresh();
}

/** Charge utile valide d'inscription d'un prestataire (référentiels créés à la volée). */
function providerPayload(array $overrides = []): array
{
    $city = City::factory()->create(['is_visible' => true]);

    return array_merge([
        'type' => 'provider',
        'name' => 'Sentinelle Test Sécurité',
        'company_type_ids' => [CompanyType::factory()->create(['is_visible' => true])->id],
        'service_type_ids' => [ServiceType::factory()->create(['is_visible' => true])->id],
        'phone' => '07 09 44 51 11',
        'city_id' => $city->id,
        'submitter_role' => 'manager',
        'is_in_service' => true,
        'description' => 'Société de gardiennage <b>fictive</b>.',
        'consent' => true,
    ], $overrides);
}

function stateForcePayload(array $overrides = []): array
{
    return array_merge([
        'type' => 'state_force',
        'name' => 'Commissariat de test',
        'force_type_id' => StateForceType::factory()->create(['is_visible' => true])->id,
        'city_id' => City::factory()->create(['is_visible' => true])->id,
        'consent' => true,
    ], $overrides);
}

/** Fiche en attente appartenant à $owner. */
function pendingProviderOf(User $owner, array $attributes = []): Provider
{
    return Provider::factory()->pending()->create($attributes + [
        'user_id' => $owner->id,
        'city_id' => City::factory()->create()->id,
    ]);
}

/** Image PNG valide générée par GD (octets). */
function pngBytes(int $w = 40, int $h = 30): string
{
    $img = imagecreatetruecolor($w, $h);
    imagefill($img, 0, 0, (int) imagecolorallocate($img, 200, 30, 30));
    ob_start();
    imagepng($img);

    return (string) ob_get_clean();
}
