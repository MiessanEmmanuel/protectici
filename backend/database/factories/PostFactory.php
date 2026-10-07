<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\PostCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Post> */
class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        $title = fake()->unique()->sentence(6);

        return [
            'author_id' => null,
            'category_id' => PostCategory::factory(),
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numerify('####'),
            'excerpt' => fake()->sentence(14),
            'body' => '<p>'.implode('</p><p>', fake()->paragraphs(3)).'</p>',
            'status' => 'published',
            'published_at' => now()->subDay(),
            'is_featured' => false,
            'is_flash' => false,
            'is_visible' => true,
            'views_count' => 0,
            'reading_minutes' => 3,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft', 'published_at' => null, 'is_visible' => false]);
    }
}
