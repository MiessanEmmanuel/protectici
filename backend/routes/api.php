<?php

use Illuminate\Support\Facades\Route;

/*
| API ProtectIci. Préfixe automatique /api (Laravel) + v1.
| Fichiers par périmètre : routes/api/auth.php (authentification), routes/api/public.php (annuaire public).
*/

// Identifiants numériques : 18 chiffres au plus, pour rester sous PHP_INT_MAX (sinon TypeError → 500 sur les
// signatures `int $id`). Un identifiant trop long donne un 404 (security.md §1, §14, §20).
Route::pattern('id', '[0-9]{1,18}');

Route::prefix('v1')->group(function () {
    require __DIR__.'/api/auth.php';
    require __DIR__.'/api/public.php';
    require __DIR__.'/api/establishments.php';
    require __DIR__.'/api/engagement.php';
    require __DIR__.'/api/admin.php';
    require __DIR__.'/api/claims.php';
    require __DIR__.'/api/content.php';
});
