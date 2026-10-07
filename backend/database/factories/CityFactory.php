<?php

namespace Database\Factories;

use App\Models\City;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<City> */
class CityFactory extends Factory
{
    protected $model = City::class;

    public function definition(): array
    {
        $name = fake()->unique()->city();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('###'),
            'country_code' => 'CI',
            'latitude' => fake()->randomFloat(6, 5.30, 5.42),
            'longitude' => fake()->randomFloat(6, -4.10, -3.90),
            'sort_order' => 0,
            'is_visible' => true,
        ];
    }
}
