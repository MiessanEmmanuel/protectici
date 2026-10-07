<?php

use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\GeocodeController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\MapMarkerController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\ReferenceDataController;
use App\Http\Controllers\Api\StateForceController;
use App\Models\Provider;
use App\Models\StateForce;
use Illuminate\Support\Facades\Route;

// Seules les fiches publiées (is_visible AND status = approved AND non supprimées) se résolvent : sinon 404.
Route::bind('publishedProvider', fn (string $slug) => Provider::query()->published()->where('slug', $slug)->firstOrFail());
Route::bind('publishedStateForce', fn (string $slug) => StateForce::query()->published()->where('slug', $slug)->firstOrFail());

Route::get('reference-data', ReferenceDataController::class);
Route::get('home', HomeController::class);

Route::middleware('throttle:public-search')->group(function () {
    Route::get('providers', [ProviderController::class, 'index']);
    Route::get('state-forces', [StateForceController::class, 'index']);
    Route::get('map/markers', MapMarkerController::class);
});

Route::get('providers/popular', [ProviderController::class, 'popular']);
Route::get('providers/{publishedProvider}', [ProviderController::class, 'show'])->name('providers.show');
Route::post('providers/{publishedProvider}/view', [ProviderController::class, 'recordView'])->middleware('throttle:provider-view');
Route::get('providers/{publishedProvider}/reviews', [ProviderController::class, 'reviews']);
Route::get('state-forces/{publishedStateForce}', [StateForceController::class, 'show']);

Route::get('geocode', GeocodeController::class)->middleware('throttle:geocode');

Route::middleware(['auth:sanctum', 'throttle:api-authenticated'])->group(function () {
    Route::get('me/favorites', [FavoriteController::class, 'index']);
    Route::put('providers/{publishedProvider}/favorite', [FavoriteController::class, 'store']);
    Route::delete('providers/{publishedProvider}/favorite', [FavoriteController::class, 'destroy']);
});
