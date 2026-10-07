<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\District;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<District> */
class DistrictFactory extends Factory
{
    protected $model = District::class;

    public function definition(): array
    {
        $name = fake()->unique()->streetName();

        return [
            'city_id' => City::factory(),
            'parent_id' => null,
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('###'),
            'latitude' => fake()->randomFloat(6, 5.30, 5.42),
            'longitude' => fake()->randomFloat(6, -4.10, -3.90),
            'is_visible' => true,
        ];
    }
}
