<?php

namespace Database\Factories;

use App\Models\City;
use App\Models\QuoteRequest;
use App\Models\ServiceType;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<QuoteRequest> */
class QuoteRequestFactory extends Factory
{
    protected $model = QuoteRequest::class;

    public function definition(): array
    {
        return [
            'last_name' => fake()->lastName(),
            'first_name' => fake()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '0700000000',
            'company_name' => fake()->company(),
            'service_type_id' => ServiceType::factory(),
            'city_id' => City::factory(),
            'description' => 'Besoin factice de gardiennage pour un site.',
            'status' => 'new',
            'consent_at' => now(),
            'ip_hash' => str_repeat('b', 64),
        ];
    }
}
