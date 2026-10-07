<?php

namespace App\Rules;

use App\Models\User;
use Illuminate\Validation\Rules\Password;

/**
 * Politique de mot de passe (security.md §12) :
 * - 12 caractères minimum pour admin/editor/provider, 10 pour user ;
 * - même règle par rôle à la réinitialisation (vérifiée après validation du jeton) ;
 * - mots de passe compromis refusés (Have I Been Pwned, k-anonymity) UNIQUEMENT en production/staging :
 *   aucun appel réseau en local ni en test.
 */
final class StrongPassword
{
    public const MIN_USER = 10;

    public const MIN_PRIVILEGED = 12;

    public const MAX = 128;

    public static function forRole(string $role): Password
    {
        return self::make($role === User::ROLE_USER ? self::MIN_USER : self::MIN_PRIVILEGED);
    }

    public static function forUser(User $user): Password
    {
        return self::forRole($user->role);
    }

    public static function make(int $min): Password
    {
        $rule = Password::min($min)->max(self::MAX);

        if (app()->environment(['production', 'staging'])) {
            $rule->uncompromised();
        }

        return $rule;
    }
}
