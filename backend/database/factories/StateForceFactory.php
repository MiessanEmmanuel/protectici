<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\StateForce;
use App\Models\StateForceType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<StateForce> */
class StateForceFactory extends Factory
{
    protected $model = StateForce::class;

    public function definition(): array
    {
        $name = 'Commissariat '.fake()->unique()->lastName();

        return [
            'user_id' => null,
            'force_type_id' => StateForceType::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('####'),
            'description' => fake()->sentence(12),
            'phone' => '+225 27 '.fake()->numerify('## ## ## ##'),
            'emergency_phone' => '110',
            'city_id' => City::factory(),
            'address' => fake()->streetAddress(),
            'latitude' => fake()->randomFloat(6, 5.30, 5.42),
            'longitude' => fake()->randomFloat(6, -4.10, -3.90),
            'is_open_24h' => true,
            'status' => 'approved',
            'is_visible' => true,
            'views_count' => 0,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending', 'is_visible' => false]);
    }

    public function hidden(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }

    public function at(float $lat, float $lng): static
    {
        return $this->state(fn () => ['latitude' => $lat, 'longitude' => $lng]);
    }
}
