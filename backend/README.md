# ProtectIci : API Laravel (backend)

API Laravel 13 (PHP 8.5, API uniquement) : PostgreSQL 16+ avec PostGIS, authentification Sanctum SPA (cookies httpOnly + CSRF), Pest, Pint, Larastan. Le contrat d'API est dans `../docs/api-contract.md`, le modèle de données dans `../modele.md`, les règles de sécurité dans `../security.md`.

## Lancement local

```bash
cd backend
composer install
cp .env.example .env            # puis renseigner DB_USERNAME / DB_PASSWORD (placeholders dans le fichier)
php artisan key:generate
php artisan migrate:fresh --seed   # référentiels + données FACTICES (refusé en production)
php artisan serve                  # http://localhost:8000
```

Prérequis : base `protectici_dev` (et `protectici_test` pour les tests) avec les extensions `postgis`, `citext`, `unaccent`, `pg_trgm` (les migrations exécutent `CREATE EXTENSION IF NOT EXISTS`). Le front attend l'API sur `http://localhost:8000` (si le port est pris : `php artisan serve --port=8001` et adapter `API_URL` côté web).

Variables clés en local : `SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000`, `FRONTEND_URL=http://localhost:3000`, `CORS_ALLOWED_ORIGINS=http://localhost:3000`, `SESSION_COOKIE=protectici_session`, `HASH_DRIVER=argon2id`, `MAIL_MAILER=log`, `TURNSTILE_ENABLED=false`. Les e-mails (vérification, réinitialisation) sont écrits dans `storage/logs/laravel.log`.

## Commandes

| Commande | Rôle |
|---|---|
| `php artisan test` | Tests Pest sur PostgreSQL `protectici_test` (jamais SQLite ; garde-fou dans `tests/TestCase.php`) |
| `DB_DATABASE=protectici_test_b php artisan test` | Idem sur une autre base de test (exécution parallèle) |
| `./vendor/bin/pint --test` | Contrôle du style (preset Laravel) ; sans `--test` pour corriger |
| `./vendor/bin/phpstan analyse --memory-limit=1G` | Larastan niveau 6 |
| `php artisan app:create-admin` | Crée un administrateur (mot de passe saisi à l'exécution, 12 caractères min.) |
| `php artisan db:seed --class=ReferenceSeeder` | Référentiels seuls (tous environnements, idempotent) |
| `composer audit` | Audit des dépendances |

## Comptes de démonstration (FACTICES, développement et staging uniquement)

Créés par `DemoSeeder` (interdit en production). Mot de passe commun, lisible dans `database/factories/UserFactory.php` (`TEST_PASSWORD`) : `MotDePasse-Test-2026!`

| Rôle | E-mail |
|---|---|
| admin | `admin@demo.protectici.test` |
| editor | `editeur@demo.protectici.test` |
| provider | `prestataire@demo.protectici.test` |
| user | `utilisateur@demo.protectici.test` |
| user (30 comptes d'avis) | `avis01@demo.protectici.test` … `avis30@demo.protectici.test` |

Les rôles `admin` et `editor` doivent activer la 2FA (TOTP) : tant qu'elle n'est pas confirmée, les routes protégées par le middleware `2fa.staff` répondent 403. Les comptes de test n'ont pas de 2FA configurée. En production, le premier administrateur se crée uniquement avec `php artisan app:create-admin`.

Données factices : ~40 prestataires (dont Dauphin Sécurité, Fenapepsci, Global Security Challenge, Puissance 6 Security, Royal Force avec RCCM, agréments, téléphones et e-mails inventés), ~30 forces étatiques, ~140 avis, 6 articles, partenaires. Quelques fiches sont volontairement non publiées (en attente, rejetée, suspendue, masquée, supprimée) pour vérifier qu'elles ne sont jamais exposées.

## Architecture

- `routes/api.php` : préfixe `/api/v1`, fichiers `routes/api/auth.php` (contrat §3) et `routes/api/public.php` (contrat §4). `/sanctum/csrf-cookie` est fourni par Sanctum.
- Contrôleurs minces, FormRequests en liste blanche, services (`app/Services`), Policies, API Resources.
- Base : migrations `database/migrations` (ordre de `modele.md` §7.2). Éléments en SQL brut dans des migrations dédiées : colonnes générées `location`, CHECK, index partiels/GiST/GIN/trigram, triggers (search_vector, note moyenne, audit immuable, garde de publication), fonctions (`fn_providers_nearby`, `fn_state_forces_nearby`, `fn_next_reference`, `sp_anonymize_user`).
- Rôles PostgreSQL (`protectici_owner/app/ro`) : migration `manage_database_roles`, inactive par défaut. Activer avec `DB_MANAGE_ROLES=true` en staging/production, puis attribuer LOGIN et mot de passe fort hors dépôt.
- Journal d'audit en ajout seul : pour purger, le rôle propriétaire désactive temporairement `trg_audit_logs_immutable` (voir la migration des triggers).
- Géocodage : interface `Geocoder` (Nominatim en production, cache, 1 requête/s, User-Agent configurable via `NOMINATIM_USER_AGENT`) ; les tests utilisent un faux géocodeur et `Http::preventStrayRequests()`.
- E-mails Resend : `MAIL_MAILER=resend` + `RESEND_API_KEY` exigent `composer require resend/resend-php` (non installé, mail en `log` en local).
