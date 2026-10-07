<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\Provider;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Provider> */
class ProviderFactory extends Factory
{
    protected $model = Provider::class;

    public function definition(): array
    {
        $name = fake()->unique()->company().' Sécurité';

        return [
            'user_id' => null,
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('####'),
            'description' => fake()->paragraph(3),
            'price_from' => fake()->randomElement([null, 75000, 120000, 250000]),
            'phone' => '+225 07 '.fake()->numerify('## ## ## ##'),
            'email' => fake()->unique()->safeEmail(),
            'address' => fake()->streetAddress(),
            'city_id' => City::factory(),
            'district_id' => null,
            'latitude' => fake()->randomFloat(6, 5.30, 5.42),
            'longitude' => fake()->randomFloat(6, -4.10, -3.90),
            'is_in_service' => true,
            'status' => 'approved',
            'is_visible' => true,
            'is_verified' => false,
            'is_featured' => false,
            'views_count' => 0,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending', 'is_visible' => false]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => 'rejected', 'is_visible' => false, 'rejection_reason' => 'Justificatifs insuffisants.']);
    }

    public function suspended(): static
    {
        return $this->state(fn () => ['status' => 'suspended', 'is_visible' => false]);
    }

    /** Approuvée mais masquée (is_visible = false). */
    public function hidden(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }

    public function featured(): static
    {
        return $this->state(fn () => ['is_featured' => true]);
    }

    public function at(float $lat, float $lng): static
    {
        return $this->state(fn () => ['latitude' => $lat, 'longitude' => $lng]);
    }

    public function withoutCoordinates(): static
    {
        return $this->state(fn () => ['latitude' => null, 'longitude' => null]);
    }
}
