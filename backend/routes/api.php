<?php

use Illuminate\Support\Facades\Route;

/*
| API ProtectIci. Préfixe automatique /api (Laravel) + v1.
| Fichiers par périmètre : routes/api/auth.php (authentification), routes/api/public.php (annuaire public).
*/
Route::prefix('v1')->group(function () {
    require __DIR__.'/api/auth.php';
    require __DIR__.'/api/public.php';
    require __DIR__.'/api/establishments.php';
    require __DIR__.'/api/admin.php';
});
