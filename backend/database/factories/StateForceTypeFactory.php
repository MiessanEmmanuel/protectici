<?php

namespace Database\Factories;

use App\Models\StateForceType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<StateForceType> */
class StateForceTypeFactory extends Factory
{
    protected $model = StateForceType::class;

    public function definition(): array
    {
        $name = ucfirst(fake()->unique()->words(3, true));

        return [
            'slug' => Str::slug($name).'-'.fake()->unique()->numerify('####'),
            'name' => $name,
            'description' => null,
            'sort_order' => 0,
            'is_visible' => true,
        ];
    }
}
