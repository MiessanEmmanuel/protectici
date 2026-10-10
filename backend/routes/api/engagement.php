<?php

use App\Http\Controllers\Admin\ContactMessageController as AdminContactMessageController;
use App\Http\Controllers\Admin\FeedbackController as AdminFeedbackController;
use App\Http\Controllers\Admin\QuoteRequestController as AdminQuoteRequestController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Admin\ReviewReportController as AdminReviewReportController;
use App\Http\Controllers\Contact\ContactController;
use App\Http\Controllers\Establishments\ProviderReviewController;
use App\Http\Controllers\Feedback\FeedbackController;
use App\Http\Controllers\Feedback\FeedbackTrackController;
use App\Http\Controllers\Quotes\ProviderQuoteController;
use App\Http\Controllers\Quotes\QuoteRequestController;
use App\Http\Controllers\Reviews\ReviewController;
use App\Http\Controllers\Reviews\ReviewReportController;
use Illuminate\Support\Facades\Route;

/*
| Phase 3 vague B (docs/api-contract.md §8) : avis, « Dis-moi tout », devis, contact.
| - Formulaires publics (feedbacks, devis, contact) : ouverts aux visiteurs ; antispam, idempotence, limites et
|   consentement sont gérés par App\Services\PublicForms\FormSubmission.
| - Espace connecté : session Sanctum + e-mail vérifié. Une ressource d'autrui se résout en 404 (jamais 403).
| - Administration : même chaîne de protection que routes/api/admin.php.
*/

// --- Formulaires publics -------------------------------------------------------------------------------------
Route::post('feedbacks', [FeedbackController::class, 'store'])->name('feedbacks.store');
Route::post('feedbacks/track', FeedbackTrackController::class)->middleware('throttle:feedback-track')->name('feedbacks.track');
Route::post('quote-requests', [QuoteRequestController::class, 'store'])->name('quote-requests.store');
Route::post('contact', [ContactController::class, 'store'])->name('contact.store');

// --- Espace connecté -----------------------------------------------------------------------------------------
Route::middleware(['auth:sanctum', 'verified.api', 'throttle:api-authenticated'])->group(function () {
    Route::post('providers/{publishedProvider}/reviews', [ReviewController::class, 'store'])
        ->middleware('throttle:review-create')->name('reviews.store');
    Route::get('me/reviews', [ReviewController::class, 'mine'])->name('me.reviews.index');
    Route::patch('me/reviews/{id}', [ReviewController::class, 'update'])->whereNumber('id')->name('me.reviews.update');
    Route::delete('me/reviews/{id}', [ReviewController::class, 'destroy'])->whereNumber('id')->name('me.reviews.destroy');
    Route::post('reviews/{id}/report', [ReviewReportController::class, 'store'])
        ->middleware('throttle:review-report')->whereNumber('id')->name('reviews.report');

    // Avis reçus par une fiche prestataire dont on est propriétaire.
    Route::prefix('me/establishments/provider/{slug}/reviews')->where(['slug' => '[a-z0-9]+(?:-[a-z0-9]+)*'])->group(function () {
        Route::get('/', [ProviderReviewController::class, 'index'])->name('me.provider-reviews.index');
        Route::post('{id}/reply', [ProviderReviewController::class, 'reply'])->whereNumber('id')->name('me.provider-reviews.reply');
    });

    // Devis adressés aux fiches du prestataire.
    Route::prefix('me/quote-requests')->whereNumber('id')->group(function () {
        Route::get('/', [ProviderQuoteController::class, 'index'])->name('me.quotes.index');
        Route::get('{id}', [ProviderQuoteController::class, 'show'])->name('me.quotes.show');
        Route::post('{id}/reply', [ProviderQuoteController::class, 'reply'])->name('me.quotes.reply');
        Route::post('{id}/decline', [ProviderQuoteController::class, 'decline'])->name('me.quotes.decline');
    });
});

// --- Administration ------------------------------------------------------------------------------------------
Route::prefix('admin')->name('admin.')
    ->middleware(['auth:sanctum', 'verified.api', 'can:admin-area', '2fa.staff', 'throttle:admin-api'])
    ->whereNumber('id')
    ->group(function () {
        Route::get('reviews', [AdminReviewController::class, 'index'])->name('reviews.index');
        Route::post('reviews/{id}/approve', [AdminReviewController::class, 'approve'])->name('reviews.approve');
        Route::post('reviews/{id}/reject', [AdminReviewController::class, 'reject'])->name('reviews.reject');
        Route::delete('reviews/{id}', [AdminReviewController::class, 'destroy'])->name('reviews.destroy');
        Route::get('review-reports', [AdminReviewReportController::class, 'index'])->name('review-reports.index');
        Route::post('review-reports/{id}/accept', [AdminReviewReportController::class, 'accept'])->name('review-reports.accept');
        Route::post('review-reports/{id}/dismiss', [AdminReviewReportController::class, 'dismiss'])->name('review-reports.dismiss');

        Route::get('feedbacks', [AdminFeedbackController::class, 'index'])->name('feedbacks.index');
        Route::get('feedbacks/{id}', [AdminFeedbackController::class, 'show'])->name('feedbacks.show');
        Route::patch('feedbacks/{id}', [AdminFeedbackController::class, 'update'])->name('feedbacks.update');
        Route::post('feedbacks/{id}/replies', [AdminFeedbackController::class, 'reply'])->name('feedbacks.reply');

        Route::get('quote-requests', [AdminQuoteRequestController::class, 'index'])->name('quote-requests.index');
        Route::get('quote-requests/{id}', [AdminQuoteRequestController::class, 'show'])->name('quote-requests.show');
        Route::post('quote-requests/{id}/dispatch', [AdminQuoteRequestController::class, 'dispatch'])->name('quote-requests.dispatch');
        Route::patch('quote-requests/{id}', [AdminQuoteRequestController::class, 'update'])->name('quote-requests.update');

        Route::get('contact-messages', [AdminContactMessageController::class, 'index'])->name('contact-messages.index');
        Route::patch('contact-messages/{id}', [AdminContactMessageController::class, 'update'])->name('contact-messages.update');
        Route::post('contact-messages/{id}/reply', [AdminContactMessageController::class, 'reply'])->name('contact-messages.reply');
    });
