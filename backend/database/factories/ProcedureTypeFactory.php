<?php

namespace Database\Factories;

use App\Models\ProcedureType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ProcedureType> */
class ProcedureTypeFactory extends Factory
{
    protected $model = ProcedureType::class;

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
