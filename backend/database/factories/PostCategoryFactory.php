<?php

namespace Database\Factories;

use App\Models\PostCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<PostCategory> */
class PostCategoryFactory extends Factory
{
    protected $model = PostCategory::class;

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
