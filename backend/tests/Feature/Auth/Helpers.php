<?php

use App\Models\User;
use Database\Factories\UserFactory;
use PragmaRX\Google2FA\Google2FA;

/*
| Fonctions utilitaires des tests d'authentification (chargées via require_once).
*/

if (! function_exists('totpCode')) {
    /** Code TOTP pour le pas courant (horloge Laravel, compatible avec travel()). */
    function totpCode(string $secret, int $stepOffset = 0): string
    {
        return (new Google2FA)->oathTotp($secret, intdiv(now()->getTimestamp(), 30) + $stepOffset);
    }

    /** Utilisateur avec 2FA confirmée. Retourne [user, secret, recovery codes]. */
    function userWithTwoFactor(?UserFactory $factory = null): array
    {
        $secret = (new Google2FA)->generateSecretKey(32);
        $codes = ['aaaaa-11111', 'bbbbb-22222', 'ccccc-33333'];

        /** @var User $user */
        $user = ($factory ?? User::factory())->create();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => $codes,
            'two_factor_confirmed_at' => now(),
        ])->save();

        return [$user->refresh(), $secret, $codes];
    }

    function loginPayload(User $user, array $extra = []): array
    {
        return array_merge(['email' => $user->email, 'password' => UserFactory::TEST_PASSWORD], $extra);
    }
}
