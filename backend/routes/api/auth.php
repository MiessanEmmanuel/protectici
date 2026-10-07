<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\CurrentUserController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Auth\PublicVerificationResendController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

/*
| Authentification (docs/api-contract.md §3). Sanctum SPA : cookies de session + CSRF.
| /sanctum/csrf-cookie est fourni par Sanctum. Limiteurs nommés : AuthRateLimitServiceProvider.
*/
Route::prefix('auth')->name('auth.')->group(function () {
    Route::post('register', RegisterController::class)->middleware('throttle:register')->name('register');
    Route::post('verification/resend', PublicVerificationResendController::class)->name('verification.resend');
    Route::post('login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login')->name('login');
    Route::post('two-factor-challenge', TwoFactorChallengeController::class)->middleware('throttle:two-factor')->name('two-factor.challenge');
    Route::post('forgot-password', PasswordResetLinkController::class)->middleware('throttle:password-reset')->name('password.email');
    Route::post('reset-password', NewPasswordController::class)->middleware('throttle:login')->name('password.reset');

    // Lien reçu par email : signature vérifiée dans le service pour rediriger aussi en cas d'échec.
    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        // Navigation depuis un e-mail (sans Origin) : la session doit être démarrée explicitement.
        ->middleware([
            'throttle:verify-email',
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
        ])
        ->where(['id' => '[0-9]+', 'hash' => '[A-Fa-f0-9]{40}'])
        ->name('verification.verify');

    Route::middleware(['auth:sanctum', 'throttle:api-authenticated'])->group(function () {
        Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
        Route::get('user', CurrentUserController::class)->name('user');
        Route::post('email/resend', EmailVerificationNotificationController::class)
            ->middleware('throttle:password-reset')
            ->name('verification.send');

        Route::middleware('throttle:two-factor')->group(function () {
            Route::post('two-factor/enable', [TwoFactorController::class, 'enable'])->name('two-factor.enable');
            Route::post('two-factor/confirm', [TwoFactorController::class, 'confirm'])->name('two-factor.confirm');
            Route::post('two-factor/disable', [TwoFactorController::class, 'disable'])->name('two-factor.disable');
        });

        Route::patch('profile', ProfileController::class)->name('profile.update');
        Route::put('password', PasswordController::class)->name('password.update');
    });
});
