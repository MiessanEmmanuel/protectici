<?php

use App\Models\City;
use App\Models\Provider;
use App\Models\StateForce;

const SUMMARY_KEYS = ['slug', 'name', 'logo_url', 'city', 'district', 'phone', 'services', 'price_from', 'rating_avg', 'rating_count', 'is_verified', 'is_featured', 'lat', 'lng', 'distance_m'];

/** Fiche publique par défaut (approuvée + visible), rattachée à une ville existante si fournie. */
function makeProvider(array $attributes = [], ?City $city = null): Provider
{
    return Provider::factory()->create($attributes + ['city_id' => $city?->id ?? City::factory()->create()->id]);
}

function makeStateForce(array $attributes = [], ?City $city = null): StateForce
{
    return StateForce::factory()->create($attributes + ['city_id' => $city?->id ?? City::factory()->create()->id]);
}
