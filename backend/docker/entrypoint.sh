#!/bin/sh
set -e
cd /app

# Caches dépendant de l'environnement injecté au démarrage (Dockploy), donc
# générés ici et non au build. Idempotent.
php artisan package:discover --ansi
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Migrations : désactivées par défaut (risque si plusieurs instances démarrent
# ensemble). À activer UNIQUEMENT sur le service backend (RUN_MIGRATIONS=true),
# jamais sur worker/scheduler. Jamais de seeder de démo en production.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

exec "$@"
