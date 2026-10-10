<?php

namespace Database\Factories;

use App\Models\Feedback;
use App\Models\FeedbackTopic;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Feedback> */
class FeedbackFactory extends Factory
{
    protected $model = Feedback::class;

    public function definition(): array
    {
        return [
            'civility' => 'M.',
            'last_name' => fake()->lastName(),
            'first_name' => fake()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '0700000000',
            'action_type' => 'question',
            'target_type' => 'employee',
            'topic_id' => FeedbackTopic::factory(),
            'comment' => 'Commentaire factice de plus de dix caractères.',
            'status' => 'new',
            'consent_at' => now(),
            'ip_hash' => str_repeat('a', 64),
        ];
    }

    public function resolvedAt(\DateTimeInterface $date): static
    {
        return $this->state(['status' => 'resolved', 'resolved_at' => $date]);
    }
}
