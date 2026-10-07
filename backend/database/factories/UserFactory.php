<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /** Mot de passe de test FACTICE, utilisé uniquement en développement et en test. */
    public const TEST_PASSWORD = 'MotDePasse-Test-2026!';

    private static ?string $hash = null;

    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => self::$hash ??= Hash::make(self::TEST_PASSWORD),
            'phone' => '+22507'.fake()->numerify('########'),
            'role' => User::ROLE_USER,
            'is_active' => true,
            // Colonnes explicites : le modèle créé est complet sans refresh() (preventAccessingMissingAttributes).
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'last_login_at' => null,
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function role(string $role): static
    {
        return $this->state(fn () => ['role' => $role]);
    }

    public function admin(): static
    {
        return $this->role(User::ROLE_ADMIN);
    }

    public function editor(): static
    {
        return $this->role(User::ROLE_EDITOR);
    }

    public function provider(): static
    {
        return $this->role(User::ROLE_PROVIDER);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
