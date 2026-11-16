<?php

use App\Http\Controllers\Admin\ClaimController as AdminClaimController;
use App\Http\Controllers\Admin\EstablishmentOwnerController;
use App\Http\Controllers\Claims\ClaimController;
use Illuminate\Support\Facades\Route;

/*
| Revendication de fiche et attribution par l'administration (docs/api-contract.md §10.3).
| Limites : 30 recherches anti-doublon par minute et par compte (limiteur numérique, compatible avec route:cache) ;
| 5 demandes ENREGISTRÉES par jour et par compte (ClaimService::DAILY_LIMIT, 429), plus un plafond large de
| 30 tentatives par heure contre le martèlement.
*/
Route::middleware(['auth:sanctum', 'verified.api', 'throttle:api-authenticated'])->group(function () {
    Route::get('establishments/similar', [ClaimController::class, 'similar'])
        ->middleware('throttle:30,1,claims-similar')->name('establishments.similar');

    Route::post('establishments/{type}/{slug}/claims', [ClaimController::class, 'store'])
        ->where(['type' => 'provider|state_force', 'slug' => '[a-z0-9]+(?:-[a-z0-9]+)*'])
        ->middleware('throttle:30,60,claims-submit')->name('establishments.claims.store');

    Route::get('me/claims', [ClaimController::class, 'mine'])->name('me.claims.index');
});

// Même chaîne de protection que routes/api/admin.php (rôle admin actif + 2FA + limiteur admin).
Route::prefix('admin')->name('admin.')
    ->middleware(['auth:sanctum', 'verified.api', 'can:admin-area', '2fa.staff', 'throttle:admin-api'])
    ->group(function () {
        Route::prefix('claims')->name('claims.')->where(['id' => '[0-9]{1,18}'])->group(function () {
            Route::get('/', [AdminClaimController::class, 'index'])->name('index');
            Route::get('{id}', [AdminClaimController::class, 'show'])->name('show');
            Route::get('{id}/document', [AdminClaimController::class, 'document'])->name('document');
            Route::post('{id}/approve', [AdminClaimController::class, 'approve'])->name('approve');
            Route::post('{id}/reject', [AdminClaimController::class, 'reject'])->name('reject');
        });

        Route::post('establishments/{type}/{id}/owner', EstablishmentOwnerController::class)
            ->where(['type' => 'provider|state_force', 'id' => '[0-9]{1,18}'])->name('establishments.owner');
    });
