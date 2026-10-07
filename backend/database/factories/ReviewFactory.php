<?php

namespace Database\Factories;

use App\Models\Provider;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Review> */
class ReviewFactory extends Factory
{
    protected $model = Review::class;

    public function definition(): array
    {
        return [
            'provider_id' => Provider::factory(),
            'user_id' => User::factory(),
            'rating' => fake()->numberBetween(1, 5),
            'title' => fake()->optional()->sentence(4),
            'body' => fake()->paragraph(2),
            'status' => 'approved',
            'is_visible' => true,
            'moderated_at' => now(),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending', 'is_visible' => false, 'moderated_at' => null]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => 'rejected', 'is_visible' => false, 'rejection_reason' => 'Contenu inapproprié.']);
    }

    public function rating(int $rating): static
    {
        return $this->state(fn () => ['rating' => $rating]);
    }

    public function replied(string $reply = 'Merci pour votre retour.'): static
    {
        return $this->state(fn () => ['provider_reply' => $reply, 'provider_replied_at' => now()]);
    }
}
