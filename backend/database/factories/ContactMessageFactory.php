<?php

namespace Database\Factories;

use App\Models\ContactMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ContactMessage> */
class ContactMessageFactory extends Factory
{
    protected $model = ContactMessage::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'subject' => 'Objet factice',
            'message' => 'Message factice de plus de dix caractères.',
            'status' => 'new',
            'consent_at' => now(),
            'ip_hash' => str_repeat('c', 64),
        ];
    }
}
