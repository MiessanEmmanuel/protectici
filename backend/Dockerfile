# syntax=docker/dockerfile:1
# =============================================================================
# API Laravel ProtectIci. Une seule image, trois rôles selon la commande :
#   web (défaut)  : frankenphp run        -> HTTP :8080
#   worker        : php artisan queue:work
#   scheduler     : php artisan schedule:work
# FrankenPHP (Caddy + PHP embarqué) plutôt que nginx + PHP-FPM : un seul
# processus, pas de supervisord, exécution non-root simple, mode classique
# (une requête = un cycle PHP, pas d'Octane, donc pas de fuite d'état).
# =============================================================================

# --- Étape 1 : dépendances Composer (sans dev) --------------------------------
# --no-scripts : package:discover exige les extensions applicatives, il est
# rejoué au démarrage du conteneur runtime (entrypoint.sh).
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader \
        --ignore-platform-reqs --prefer-dist
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts

# --- Étape 2 : runtime ---------------------------------------------------------
FROM dunglas/frankenphp:1-php8.4-alpine AS runtime

RUN install-php-extensions pdo_pgsql pgsql gd intl opcache bcmath zip pcntl

# Durcissement PHP : expose_php=Off, aucune erreur affichée, opcache figé.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && { \
        echo 'expose_php=Off'; \
        echo 'display_errors=Off'; \
        echo 'display_startup_errors=Off'; \
        echo 'log_errors=On'; \
        echo 'upload_max_filesize=10M'; \
        echo 'post_max_size=12M'; \
        echo 'memory_limit=256M'; \
        echo 'opcache.enable=1'; \
        echo 'opcache.validate_timestamps=0'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.memory_consumption=192'; \
    } > "$PHP_INI_DIR/conf.d/zz-app.ini"

# Journaux sur stderr (visibles dans Dockploy) ; surchargeable par l'env.
ENV LOG_CHANNEL=stderr \
    APP_ENV=production \
    APP_DEBUG=false \
    SERVER_NAME=:8080 \
    XDG_CONFIG_HOME=/tmp/caddy-config \
    XDG_DATA_HOME=/tmp/caddy-data

WORKDIR /app
COPY --from=vendor /app ./
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Lien public/storage -> storage/app/public : médias servis par l'API quand MEDIA_DISK=public.
# Non-root : utilisateur 1001. Les capacités de liaison de ports < 1024
# (setcap) sont retirées car le serveur écoute sur 8080.
RUN addgroup -g 1001 -S app && adduser -u 1001 -S -G app app \
    && setcap -r /usr/local/bin/frankenphp || true \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
        storage/framework/testing storage/logs storage/app/public storage/app/private \
        bootstrap/cache /tmp/caddy-config /tmp/caddy-data \
    && chown -R app:app storage bootstrap/cache /tmp/caddy-config /tmp/caddy-data \
    && chmod -R u+rwX storage bootstrap/cache \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && rm -rf public/storage && ln -s /app/storage/app/public public/storage

USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:8080/up") === false ? 1 : 0);'

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
