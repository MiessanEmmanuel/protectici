<?php

namespace Database\Factories;

use App\Models\Provider;
use App\Models\ProviderExecutive;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ProviderExecutive> */
class ProviderExecutiveFactory extends Factory
{
    protected $model = ProviderExecutive::class;

    public function definition(): array
    {
        return [
            'provider_id' => Provider::factory(),
            'full_name' => fake()->name(),
            'position' => fake()->randomElement(['general_manager', 'commercial_manager', 'operations_manager']),
            'position_label' => null,
            'sort_order' => 0,
            'is_visible' => true,
        ];
    }

    public function hiddenFromPublic(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }
}
