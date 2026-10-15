<?php

use App\Http\Controllers\Admin\NewsletterSubscriberController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Blog\BlogController;
use App\Http\Controllers\Blog\CommentController;
use App\Http\Controllers\Blog\SitePageController;
use App\Http\Controllers\Content\CategoryController;
use App\Http\Controllers\Content\CommentController as ContentCommentController;
use App\Http\Controllers\Content\MediaController;
use App\Http\Controllers\Content\PageController;
use App\Http\Controllers\Content\PartnerController;
use App\Http\Controllers\Content\PostController;
use App\Http\Controllers\Newsletter\NewsletterController;
use Illuminate\Support\Facades\Route;

/*
| Phase 4 (docs/api-contract.md §9) : contenu éditorial.
| - Public : lecture seule des contenus publiés (limiteur public-read), newsletter à double opt-in.
| - /content/* : rôles editor ET admin (Gate content-area), 2FA obligatoire pour le personnel (2fa.staff).
|   Les écritures réservées à l'admin (pages, partenaires) sont revérifiées par Gate admin-area dans le contrôleur.
| - /admin/settings et /admin/newsletter/* : admin uniquement (Gate admin-area : l'éditeur reçoit 403).
*/
$slug = '[a-z0-9]+(?:-[a-z0-9]+)*';

// --- Public --------------------------------------------------------------------------------------------------
Route::middleware('throttle:public-read')->group(function () use ($slug) {
    Route::get('blog/categories', [BlogController::class, 'categories'])->middleware('public.cache:blog,120')->name('blog.categories');
    Route::get('blog/flash', [BlogController::class, 'flash'])->middleware('public.cache:blog,60')->name('blog.flash');
    Route::get('blog/posts', [BlogController::class, 'index'])->middleware('public.cache:blog,60')->name('blog.posts.index');
    Route::get('blog/posts/{slug}', [BlogController::class, 'show'])->where('slug', $slug)->name('blog.posts.show');
    Route::get('blog/posts/{slug}/comments', [CommentController::class, 'index'])->where('slug', $slug)->name('blog.comments.index');
    Route::get('pages/{slug}', [SitePageController::class, 'page'])->where('slug', $slug)->middleware('public.cache:site,300')->name('pages.show');
    Route::get('partners', [SitePageController::class, 'partners'])->middleware('public.cache:site,300')->name('partners.index');
    Route::get('settings/public', [SitePageController::class, 'settings'])->middleware('public.cache:site,300')->name('settings.public');
});

Route::post('blog/posts/{slug}/comments', [CommentController::class, 'store'])
    ->middleware(['auth:sanctum', 'verified.api', 'throttle:api-authenticated', 'throttle:blog-comment'])
    ->where('slug', $slug)->name('blog.comments.store');

Route::prefix('newsletter')->name('newsletter.')->group(function () {
    Route::post('subscribe', [NewsletterController::class, 'subscribe'])->name('subscribe');
    Route::get('confirm', [NewsletterController::class, 'confirm'])->middleware('throttle:newsletter-link')->name('confirm');
    Route::post('unsubscribe', [NewsletterController::class, 'unsubscribe'])->middleware('throttle:newsletter-link')->name('unsubscribe');
});

// --- Back-office contenu (editor + admin) --------------------------------------------------------------------
Route::prefix('content')->name('content.')
    ->middleware(['auth:sanctum', 'verified.api', 'can:content-area', '2fa.staff', 'throttle:content-api'])
    ->whereNumber('id')
    ->group(function () use ($slug) {
        Route::get('posts', [PostController::class, 'index'])->name('posts.index');
        Route::post('posts', [PostController::class, 'store'])->name('posts.store');
        Route::get('posts/{id}', [PostController::class, 'show'])->name('posts.show');
        Route::patch('posts/{id}', [PostController::class, 'update'])->name('posts.update');
        Route::delete('posts/{id}', [PostController::class, 'destroy'])->name('posts.destroy');

        Route::post('media', [MediaController::class, 'store'])->middleware('throttle:content-upload')->name('media.store');

        Route::get('comments', [ContentCommentController::class, 'index'])->name('comments.index');
        Route::patch('comments/{id}', [ContentCommentController::class, 'update'])->name('comments.update');

        Route::get('pages', [PageController::class, 'index'])->name('pages.index');
        Route::get('pages/{slug}', [PageController::class, 'show'])->where('slug', $slug)->name('pages.show');
        Route::put('pages/{slug}', [PageController::class, 'update'])->where('slug', $slug)->name('pages.update');

        Route::get('partners', [PartnerController::class, 'index'])->name('partners.index');
        Route::post('partners', [PartnerController::class, 'store'])->name('partners.store');
        Route::get('partners/{id}', [PartnerController::class, 'show'])->name('partners.show');
        Route::patch('partners/{id}', [PartnerController::class, 'update'])->name('partners.update');
        Route::delete('partners/{id}', [PartnerController::class, 'destroy'])->name('partners.destroy');

        Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
        Route::get('categories/{id}', [CategoryController::class, 'show'])->name('categories.show');
        Route::patch('categories/{id}', [CategoryController::class, 'update'])->name('categories.update');
    });

// --- Administration (admin + 2FA) ----------------------------------------------------------------------------
Route::prefix('admin')->name('admin.')
    ->middleware(['auth:sanctum', 'verified.api', 'can:admin-area', '2fa.staff', 'throttle:admin-api'])
    ->group(function () {
        Route::get('settings', [SettingsController::class, 'index'])->name('settings.index');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
        Route::get('newsletter/subscribers', [NewsletterSubscriberController::class, 'index'])->name('newsletter.subscribers');
    });
