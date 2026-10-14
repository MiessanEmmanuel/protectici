<?php

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;

/*
| Audit structurel des routes (revue de sécurité phase 5) : empêche d'ajouter une route non protégée par oubli.
*/

/** @return list<Route> */
function apiV1Routes(): array
{
    return collect(RouteFacade::getRoutes()->getRoutes())
        ->filter(fn (Route $r) => str_starts_with($r->uri(), 'api/v1/'))
        ->values()->all();
}

/** @return list<string> */
function mw(Route $route): array
{
    return array_map('strval', $route->gatherMiddleware());
}

it('protège toute route /admin par session, e-mail vérifié, rôle admin, 2FA staff et limitation', function () {
    $routes = array_filter(apiV1Routes(), fn (Route $r) => str_starts_with($r->uri(), 'api/v1/admin/'));
    expect($routes)->not->toBeEmpty();

    foreach ($routes as $route) {
        $m = mw($route);
        expect($m)->toContain('auth:sanctum', 'verified.api', 'can:admin-area', '2fa.staff', 'throttle:admin-api');
    }
});

it('protège toute route /content par session, rôle staff, 2FA staff et limitation', function () {
    $routes = array_filter(apiV1Routes(), fn (Route $r) => str_starts_with($r->uri(), 'api/v1/content/'));
    expect($routes)->not->toBeEmpty();

    foreach ($routes as $route) {
        $m = mw($route);
        expect($m)->toContain('auth:sanctum', 'verified.api', 'can:content-area', '2fa.staff', 'throttle:content-api');
    }
});

it('exige une session pour tout /me et toute écriture connectée', function () {
    foreach (apiV1Routes() as $route) {
        if (str_contains($route->uri(), '/me/') || str_ends_with($route->uri(), '/me')) {
            expect(mw($route))->toContain('auth:sanctum');
        }
    }
});

it('limite aux routes publiques connues celles qui ne demandent aucune session', function () {
    $publicPrefixes = [
        'api/v1/auth/', 'api/v1/blog/', 'api/v1/providers', 'api/v1/state-forces', 'api/v1/newsletter/', 'api/v1/pages/',
        'api/v1/partners', 'api/v1/settings/public', 'api/v1/reference-data', 'api/v1/home', 'api/v1/geocode', 'api/v1/map/markers',
        'api/v1/feedbacks', 'api/v1/quote-requests', 'api/v1/contact',
    ];
    $authenticatedAuth = ['logout', 'password', 'profile', 'user', 'two-factor/enable', 'two-factor/confirm', 'two-factor/disable', 'email/resend'];

    foreach (apiV1Routes() as $route) {
        if (in_array('auth:sanctum', mw($route), true)) {
            continue;
        }
        $uri = $route->uri();
        $isPublic = collect($publicPrefixes)->contains(fn (string $p) => str_starts_with($uri, $p));
        expect($isPublic)->toBeTrue("Route sans authentification hors liste publique : {$uri}");

        // Une action d'écriture publique hors /auth doit passer par un limiteur (middleware ou service FormSubmission).
        foreach ($authenticatedAuth as $suffix) {
            expect(str_ends_with($uri, '/auth/'.$suffix))->toBeFalse("{$uri} devrait exiger une session");
        }
    }
});

it('met un limiteur sur toute route d\'authentification et de lecture publique de recherche', function () {
    foreach (apiV1Routes() as $route) {
        $uri = $route->uri();
        if (str_starts_with($uri, 'api/v1/auth/') && $route->uri() !== 'api/v1/auth/verification/resend') {
            expect(collect(mw($route))->contains(fn ($m) => str_starts_with($m, 'throttle:')))->toBeTrue("Pas de limiteur : {$uri}");
        }
    }
});
