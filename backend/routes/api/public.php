<?php

use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\GeocodeController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\MapMarkerController;
use App\Http\Controllers\Api\ProviderController;
use App\Http\Controllers\Api\ReferenceDataController;
use App\Http\Controllers\Api\StateForceController;
use Illuminate\Support\Facades\Route;

// Liaisons {publishedProvider} / {publishedStateForce} : AppServiceProvider::registerRouteBindings()
// (un Route::bind placé ici est perdu quand les routes sont en cache, cf. php artisan route:cache).

Route::get('reference-data', ReferenceDataController::class)->middleware('public.cache:directory,300');
Route::get('home', HomeController::class)->middleware('public.cache:directory,60');

Route::middleware(['throttle:public-search', 'public.cache:directory,60'])->group(function () {
    Route::get('providers', [ProviderController::class, 'index']);
    Route::get('state-forces', [StateForceController::class, 'index']);
    Route::get('map/markers', MapMarkerController::class);
});

Route::get('providers/popular', [ProviderController::class, 'popular'])->middleware('public.cache:directory,60');
Route::get('providers/{publishedProvider}', [ProviderController::class, 'show'])->name('providers.show')->middleware('public.cache:directory,60');
Route::post('providers/{publishedProvider}/view', [ProviderController::class, 'recordView'])->middleware('throttle:provider-view');
Route::get('providers/{publishedProvider}/reviews', [ProviderController::class, 'reviews'])->middleware('public.cache:directory,60');
Route::get('state-forces/{publishedStateForce}', [StateForceController::class, 'show'])->middleware('public.cache:directory,60');

Route::get('geocode', GeocodeController::class)->middleware('throttle:geocode');

Route::middleware(['auth:sanctum', 'throttle:api-authenticated'])->group(function () {
    Route::get('me/favorites', [FavoriteController::class, 'index']);
    Route::put('providers/{publishedProvider}/favorite', [FavoriteController::class, 'store']);
    Route::delete('providers/{publishedProvider}/favorite', [FavoriteController::class, 'destroy']);
});
