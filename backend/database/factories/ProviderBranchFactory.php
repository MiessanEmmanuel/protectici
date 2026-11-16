<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\Provider;
use App\Models\ProviderBranch;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ProviderBranch> */
class ProviderBranchFactory extends Factory
{
    protected $model = ProviderBranch::class;

    public function definition(): array
    {
        return [
            'provider_id' => Provider::factory(),
            'label' => 'Agence de '.fake()->randomElement(['Yopougon', 'Cocody', 'Marcory', 'Treichville', 'Abobo', 'Koumassi']),
            'city_id' => City::factory(),
            'district_id' => null,
            'address' => fake()->numberBetween(1, 120).' rue '.fake()->lastName().' (adresse fictive)',
            'geo_description' => null,
            'phone' => '+22507'.fake()->numerify('########'),
            'latitude' => fake()->randomFloat(6, 5.30, 5.42),
            'longitude' => fake()->randomFloat(6, -4.10, -3.90),
            'sort_order' => 0,
        ];
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
