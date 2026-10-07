<?php

namespace Database\Factories;

use App\Models\CompanyType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<CompanyType> */
class CompanyTypeFactory extends Factory
{
    protected $model = CompanyType::class;

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
