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
- E-mails Resend : `resend/resend-php` est installé ; `MAIL_MAILER=resend` + `RESEND_API_KEY` en staging/production, `log` en local.

## Phase 3 vague A : établissements, espace prestataire, administration

Contrat : `../docs/api-contract.md` §7. Routes : `routes/api/establishments.php` (propriétaire) et `routes/api/admin.php`.

- **Propriétaire** (session + e-mail vérifié) : `POST /establishments` (en-tête `Idempotency-Key`, 3/jour/IP et 5/jour/utilisateur sur les créations réelles), `GET /me/establishments`, `GET|PATCH /me/establishments/{type}/{slug}`, `POST .../resubmit`, `POST|DELETE .../change-requests`, `POST|DELETE .../documents` (disque privé), `POST|DELETE .../media`. Établissement d'autrui = 404.
- **Admin** (`/admin/*` : rôle `admin` actif + 2FA confirmée + session 30 min ; editor/provider/user = 403) : tableau de bord, établissements (approve/reject/suspend/restore/verify/unverify/delete avec `confirm_name`), demandes de modification, téléchargement des justificatifs (flux `attachment`, chaque accès audité), utilisateurs (rôle, activation, anonymisation avec `confirm_email`), référentiels, journal d'audit, notifications internes.
- **Stockage** : `MEDIA_DISK` (défaut `public`, lancer `php artisan storage:link` en local) et `DOCUMENTS_DISK` (défaut `private`, jamais d'URL). Images réencodées en WebP par GD (EXIF supprimé, côté max borné), justificatifs PDF/JPEG/PNG vérifiés par contenu. Staging/production : disques `s3` / `s3-private` (R2) : exige `composer require league/flysystem-aws-s3-v3` (NON installé ici).
- **E-mails** : `App\Notifications\Establishment\EstablishmentMail` (reçue, validée, rejetée, suspendue, modification approuvée/rejetée), envoyés une seule fois par transition. Notifications internes : `AdminAlert` (base de données).
- **Données de démo** : le compte `prestataire@demo.protectici.test` possède 2 fiches `pending`, une demande de modification en attente sur Dauphin Sécurité et un justificatif factice ; `utilisateur@demo.protectici.test` possède une force étatique `pending`. Pour tester l'admin : activer la 2FA du compte `admin@demo.protectici.test` (voir plus haut).
- Config : `config/establishments.php` (limites, disques). Nettoyage des clés d'idempotence : table `idempotency_keys` (pas encore purgée automatiquement).

## Phase 3 vague B : avis, « Dis-moi tout », devis, contact

Contrat : `../docs/api-contract.md` §8. Routes : `routes/api/engagement.php`.

- **Formulaires publics** (feedbacks, devis, contact) : compte facultatif, `consent` obligatoire (tracé dans `consent_logs`, finalités `feedback`/`quote`/`contact`), champ piège `company_website` (rempli : réponse de succès identique mais rien n'est enregistré ni envoyé), Turnstile si `TURNSTILE_ENABLED=true`, en-tête `Idempotency-Key` (8 à 64 caractères ; même clé + mêmes données = une seule ressource, une clé réutilisée avec un corps différent donne 422). Socle commun : `App\Services\PublicForms\FormSubmission`. Limites dans `config/public_forms.php` (5/h/IP et 10/jour/e-mail ; suivi de dossier 10/h/IP et 5/h/référence ; avis 10/jour/utilisateur), comptées sur les créations réelles seulement.
- **Avis** : un par utilisateur et prestataire, modérés ; édition ⇒ retour en `pending` et masqué ; réponse unique du propriétaire ; signalements traités par l'admin. La note moyenne est recalculée par le trigger PostgreSQL.
- **« Dis-moi tout »** : référence `DMT-AAAA-nnnnnn` (`fn_next_reference`) ; suivi par `POST /feedbacks/track` (référence + e-mail, 404 générique identique dans les deux cas d'échec, jamais de réponse interne).
- **Devis** : référence `DEV-AAAA-nnnnnn` ; l'`id` d'un devis côté prestataire est l'id du **destinataire** (`quote_request_recipients`). Les coordonnées du demandeur ne sont visibles que du destinataire et de l'admin.
- **E-mails en file d'attente** : toutes les notifications d'e-mail (sauf la réinitialisation de mot de passe, qui contient un jeton secret et reste synchrone) sont `ShouldQueueAfterCommit` (driver `database`, 3 essais). **Un worker est obligatoire** : `php artisan queue:work --tries=3 --max-time=3600` (en production, un service Dockploy dédié ou superviseur). En test, `QUEUE_CONNECTION=sync`. Un échec d'envoi n'annule jamais l'action ; `php artisan queue:failed` liste les échecs.
- **Notifications internes** : `AdminAlert` (nouvel avis, signalement, dossier, devis, message) via `GET /admin/notifications` ; compteurs ajoutés à `/admin/dashboard`.
- **Rétention** (planifiée chaque nuit, `routes/console.php`) : `retention:purge-idempotency-keys` (> 48 h), `retention:purge-contact-messages` (> 12 mois), `retention:anonymize-feedbacks` (> 36 mois après clôture), `retention:anonymize-quote-requests` (> 24 mois), `retention:purge-establishment-files` (fiches supprimées > 30 jours) ; `retention:run` les enchaîne à la main. Chaque exécution écrit un événement dans `audit_logs` sans donnée personnelle. Le planificateur exige `php artisan schedule:work` ou un cron `* * * * * php artisan schedule:run`. Vérification : `php artisan schedule:list`.

### Stockage S3 / Cloudflare R2 (staging, production)

`league/flysystem-aws-s3-v3` est installé. Variables d'environnement (secrets uniquement dans Dockploy) :

```
MEDIA_DISK=s3
DOCUMENTS_DISK=s3-private
AWS_ACCESS_KEY_ID=…  AWS_SECRET_ACCESS_KEY=…  AWS_DEFAULT_REGION=auto
AWS_BUCKET=protectici-media-<env>  AWS_PRIVATE_BUCKET=protectici-private-<env>
AWS_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_URL=https://media.<domaine>        # domaine public du bucket médias
AWS_USE_PATH_STYLE_ENDPOINT=true
DOCUMENTS_SIGNED_URL_TTL_MINUTES=5     # 1 à 10
```

1. Cloudflare R2 : créer deux buckets par environnement (médias, privé). 2. Bucket médias : domaine personnalisé comme accès public (pas de `r2.dev` en production), CORS GET/HEAD depuis le site. 3. Bucket privé : rien de public ; l'API redirige (302) l'administrateur vers une URL signée de 5 minutes (`Content-Disposition: attachment`), chaque accès est audité. 4. Jeton API S3 « Object Read & Write » limité aux deux buckets. À valider en staging : R2 ne gère pas les ACL par objet (les managers passent une visibilité `public`/`private` à `put`).
Sans compte R2, aucun appel réseau n'est fait : les tests utilisent `Storage::fake` et la signature locale d'URL.

Données de démo vague B : signalements ouverts, dossiers « Dis-moi tout » (5 statuts), devis avec destinataires, messages de contact.
