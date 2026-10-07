<?php

namespace Database\Factories;

use App\Models\Partner;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Partner> */
class PartnerFactory extends Factory
{
    protected $model = Partner::class;

    public function definition(): array
    {
        return [
            'type' => fake()->randomElement(['partner', 'client']),
            'name' => fake()->unique()->company(),
            'website_url' => null,
            'description' => fake()->sentence(),
            'sort_order' => 0,
            'is_visible' => true,
        ];
    }
}
