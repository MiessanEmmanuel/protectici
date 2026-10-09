<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\ChangeRequestController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DocumentDownloadController;
use App\Http\Controllers\Admin\EstablishmentController;
use App\Http\Controllers\Admin\NotificationController;
use App\Http\Controllers\Admin\ReferenceController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

/*
| Administration (docs/api-contract.md §7.3). Chaîne de protection commune :
|   auth:sanctum -> e-mail vérifié -> Gate admin-area (rôle admin actif ; éditeur = 403)
|   -> 2fa.staff (2FA confirmée obligatoire) -> limiteur admin-api.
| L'inactivité staff (30 min) est appliquée par StaffSessionInactivity (groupe api). Chaque contrôleur autorise en
| plus l'action par Policy. Chaque action sensible est écrite dans audit_logs.
*/
Route::prefix('admin')->name('admin.')
    ->middleware(['auth:sanctum', 'verified.api', 'can:admin-area', '2fa.staff', 'throttle:admin-api'])
    ->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');

        Route::prefix('establishments')->name('establishments.')->group(function () {
            Route::get('/', [EstablishmentController::class, 'index'])->name('index');

            Route::prefix('{type}/{id}')->where(['type' => 'provider|state_force', 'id' => '[0-9]+'])->group(function () {
                Route::get('/', [EstablishmentController::class, 'show'])->name('show');
                Route::patch('/', [EstablishmentController::class, 'update'])->name('update');
                Route::delete('/', [EstablishmentController::class, 'destroy'])->name('destroy');
                Route::post('approve', [EstablishmentController::class, 'approve'])->name('approve');
                Route::post('reject', [EstablishmentController::class, 'reject'])->name('reject');
                Route::post('suspend', [EstablishmentController::class, 'suspend'])->name('suspend');
                Route::post('restore', [EstablishmentController::class, 'restore'])->name('restore');
                Route::post('verify', [EstablishmentController::class, 'verify'])->name('verify');
                Route::post('unverify', [EstablishmentController::class, 'unverify'])->name('unverify');
            });
        });

        Route::get('documents/{id}/download', DocumentDownloadController::class)->whereNumber('id')->name('documents.download');

        Route::prefix('change-requests')->name('change-requests.')->where(['id' => '[0-9]+'])->group(function () {
            Route::get('/', [ChangeRequestController::class, 'index'])->name('index');
            Route::post('{id}/approve', [ChangeRequestController::class, 'approve'])->name('approve');
            Route::post('{id}/reject', [ChangeRequestController::class, 'reject'])->name('reject');
        });

        Route::prefix('users')->name('users.')->where(['id' => '[0-9]+'])->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('{id}', [UserController::class, 'show'])->name('show');
            Route::patch('{id}', [UserController::class, 'update'])->name('update');
            Route::post('{id}/anonymize', [UserController::class, 'anonymize'])->name('anonymize');
        });

        Route::prefix('reference/{resource}')->name('reference.')
            ->where(['resource' => 'cities|districts|company-types|service-types|state-force-types|procedure-types|feedback-topics|post-categories'])
            ->group(function () {
                Route::get('/', [ReferenceController::class, 'index'])->name('index');
                Route::post('/', [ReferenceController::class, 'store'])->name('store');
                Route::patch('{id}', [ReferenceController::class, 'update'])->whereNumber('id')->name('update');
                Route::delete('{id}', [ReferenceController::class, 'destroy'])->whereNumber('id')->name('destroy');
            });

        Route::get('audit-logs', AuditLogController::class)->name('audit-logs');

        Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead'])
            ->whereUuid('id')->name('notifications.read');
    });
