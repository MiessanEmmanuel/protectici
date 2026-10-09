<?php

use App\Http\Controllers\Establishments\ChangeRequestController;
use App\Http\Controllers\Establishments\DocumentController;
use App\Http\Controllers\Establishments\EstablishmentRegistrationController;
use App\Http\Controllers\Establishments\MediaController;
use App\Http\Controllers\Establishments\MyEstablishmentController;
use Illuminate\Support\Facades\Route;

/*
| Inscription d'établissement et espace prestataire (docs/api-contract.md §7.2).
| Toutes les routes exigent une session Sanctum et un e-mail vérifié. Un établissement n'est résolu que s'il
| appartient à l'utilisateur connecté (sinon 404, jamais 403 : on ne révèle pas son existence).
*/
Route::middleware(['auth:sanctum', 'verified.api', 'throttle:api-authenticated'])->group(function () {
    Route::post('establishments', EstablishmentRegistrationController::class)->name('establishments.store');

    Route::prefix('me/establishments')->name('me.establishments.')->group(function () {
        Route::get('/', [MyEstablishmentController::class, 'index'])->name('index');

        Route::prefix('{type}/{slug}')
            ->where(['type' => 'provider|state_force', 'slug' => '[a-z0-9]+(?:-[a-z0-9]+)*'])
            ->group(function () {
                Route::get('/', [MyEstablishmentController::class, 'show'])->name('show');
                Route::patch('/', [MyEstablishmentController::class, 'update'])->name('update');
                Route::post('resubmit', [MyEstablishmentController::class, 'resubmit'])->name('resubmit');

                Route::post('change-requests', [ChangeRequestController::class, 'store'])->name('change-requests.store');
                Route::delete('change-requests/{id}', [ChangeRequestController::class, 'destroy'])->whereNumber('id')->name('change-requests.destroy');

                Route::post('documents', [DocumentController::class, 'store'])->name('documents.store');
                Route::delete('documents/{id}', [DocumentController::class, 'destroy'])->whereNumber('id')->name('documents.destroy');

                Route::post('media', [MediaController::class, 'store'])->name('media.store');
                Route::delete('media/{id}', [MediaController::class, 'destroy'])->whereNumber('id')->name('media.destroy');
            });
    });
});
