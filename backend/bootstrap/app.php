<?php

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\EnsureTwoFactorForStaff;
use App\Http\Middleware\EnsureVerifiedEmail;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\StaffSessionInactivity;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cloudflare / reverse proxy : IP réelle uniquement via les proxies déclarés (security.md §18).
        $trusted = array_values(array_filter(array_map('trim', explode(',', (string) ($_ENV['TRUSTED_PROXIES'] ?? $_SERVER['TRUSTED_PROXIES'] ?? getenv('TRUSTED_PROXIES') ?: '')))));
        if ($trusted !== []) {
            $middleware->trustProxies(at: $trusted === ['*'] ? '*' : $trusted);
        }

        // Sanctum SPA : cookies de session + CSRF pour les origines « stateful ».
        $middleware->statefulApi();

        // Global : couvre aussi les 404 et /sanctum/csrf-cookie.
        $middleware->append(SecurityHeaders::class);

        // Authentification : garde de session (inactivité admin/editor, comptes désactivés) sur tout le
        // groupe api, et 2FA obligatoire pour le staff sur les routes qui le demandent (security.md §12).
        $middleware->appendToGroup('api', StaffSessionInactivity::class);
        $middleware->prependToPriorityList(before: AuthenticatesRequests::class, prepend: StaffSessionInactivity::class);
        $middleware->alias([
            '2fa.staff' => EnsureTwoFactorForStaff::class,
            'verified.api' => EnsureVerifiedEmail::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API uniquement : toujours du JSON, jamais de page HTML d'erreur.
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $e): bool => true);
        $exceptions->render(new ApiExceptionRenderer);
    })->create();
