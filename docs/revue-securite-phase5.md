# Revue de sécurité — phase 5

Date : 2026-10-14. Périmètre : phases 1 à 4 (API Laravel 13 `backend/`, Next.js 16 `web/`).
Méthode : relecture de code, audit structurel des routes (`php artisan route:list`, 110 routes `/api/v1`), tests dynamiques par `curl` (cookies Sanctum, CSRF, Origin/Referer) sur l'API 8001 et le web 3001 (comptes de démo, sans test de charge), audit des dépendances, revue de la configuration de production (Dockerfile, Caddyfile, compose prod).

## Résumé

| Gravité | Constats | Corrigés |
|---|---|---|
| Élevée | 1 | 1 |
| Moyenne | 4 | 4 |
| Faible | 3 | 1 (2 acceptés/documentés) |
| Information | 5 | — |

Suites après corrections : Pest **606 passés (4941 assertions)** ; Pint propre ; Larastan sans erreur ; Vitest **359 passés (39 fichiers)** ; `tsc --noEmit` et ESLint propres. Base de référence avant revue : Pest 595 passés. 11 tests Pest et 2 tests Vitest ajoutés.

## Constats corrigés

### C1 — Élevée — Le rendu serveur Next.js partage un seul seau de limitation (auto-déni de service)
- Preuve : `web/src/lib/api/server.ts` appelle l'API depuis le conteneur `web` (`API_INTERNAL_URL`) sans IP client. Les limiteurs `public-search` et `public-read` (60/min) sont indexés par IP : toutes les pages SSR de tous les visiteurs partagent donc 60 requêtes/minute. Au-delà, le site public répond 429. (Le cache `revalidate: 60` atténue mais ne supprime pas le risque : recherches variées, blog, fiches.)
- Correctif : en-tête `X-SSR-Secret` ajouté par le client serveur (variable serveur `SSR_SHARED_SECRET`, jamais `NEXT_PUBLIC_*`). Côté API, `AppServiceProvider::publicReadLimit()` compare en temps constant et attribue un seau distinct (1200/min, `SSR_RATE_PER_MINUTE`). Secret vide = mécanisme désactivé, comportement inchangé. Les navigateurs restent à 60/min/IP.
- Tests : `ProvidersListTest` (deux cas : secret valide, mauvais secret, secret absent) ; `web/tests/api-ssr-header.test.ts` (2 cas).
- **Action de déploiement restante** : ajouter `SSR_SHARED_SECRET` (même valeur, `openssl rand -hex 32`) aux environnements `backend` ET `web` de `docker-compose.prod.yml` / Dockploy. Je n'ai pas modifié les fichiers compose racine (hors périmètre autorisé). Sans cela, le risque demeure en production.
- Statut : corrigé dans le code, **à activer en déploiement**.

### C2 — Moyenne — Injection d'en-tête `Host` dans les liens signés de vérification d'e-mail
- Preuve : `VerifyEmailNotification::verificationUrl()` utilise `URL::temporarySignedRoute()`, qui part de l'hôte de la requête entrante. Un attaquant pouvant faire parvenir une inscription avec un `Host`/`X-Forwarded-Host` forgé pouvait faire émettre un lien signé pointant vers un domaine tiers (hameçonnage, vol du jeton signé).
- Correctif : `AppServiceProvider::pinRootUrl()` force racine et schéma sur `APP_URL` en production et staging (hors local/test pour ne pas casser les ports de dev).
- Test : `InfrastructureTest` « ancre les URL générées sur APP_URL en production ».
- Statut : corrigé.

### C3 — Moyenne — Pas de plafond par IP sur la connexion (password spraying)
- Preuve : le limiteur `login` était indexé par couple (e-mail + IP) : 5 essais/minute par compte, mais un nombre illimité de comptes depuis une même IP, avec un coût CPU Argon2id par tentative. Il sert aussi à `reset-password`.
- Correctif : second plafond `login-ip` à 30/minute/IP dans `AuthRateLimitServiceProvider`.
- Test : `LoginTest` « plafonne aussi la connexion par IP (30 / minute) ».
- Risque résiduel : utilisateurs derrière une même IP mobile (CGNAT) : 30/min reste large pour un usage normal.
- Statut : corrigé.

### C4 — Moyenne — Masquage des PII absent de certains canaux de journalisation
- Preuve : `RedactSensitiveData` n'était appliqué qu'aux canaux `single` et `daily`. Le déploiement de production utilise `LOG_CHANNEL=stderr` (Dockerfile et compose), qui n'avait pas ce masquage : e-mails/téléphones dans les `QueryException` et les traces auraient été écrits en clair dans les journaux Docker.
- Correctif : `tap` ajouté aux canaux `monthly`, `slack`, `papertrail`, `stderr`, `syslog`, `errorlog` (`config/logging.php`).
- Test : `RedactSensitiveDataTest` vérifie que chaque canal réel porte le masquage.
- Statut : corrigé.

### C5 — Moyenne — Cookie de session non « Secure » par défaut si la variable manque
- Preuve : `config/session.php` : `'secure' => env('SESSION_SECURE_COOKIE')` vaut `null` si la variable est absente. Le compose de production la force, mais un autre mode de déploiement (Dockploy sans le compose) produirait un cookie sans `Secure`.
- Correctif : valeur par défaut `true` quand `APP_ENV` est `production` ou `staging`.
- Test : `InfrastructureTest` « rend le cookie de session Secure par défaut en production ».
- Statut : corrigé.

### C6 — Faible — Absence de garde-fou automatique sur la protection des routes
- Correctif : `tests/Feature/RouteSecurityAuditTest.php` (5 tests) : toute route `/admin/*` doit porter `auth:sanctum`, `verified.api`, `can:admin-area`, `2fa.staff`, `throttle:admin-api` ; toute route `/content/*` l'équivalent staff ; tout `/me/*` exige une session ; toute route sans session doit figurer dans une liste publique explicite ; toute route `/auth/*` porte un limiteur. Une route ajoutée par oubli sans protection fait échouer la suite.
- Statut : ajouté.

## Constats non corrigés (acceptés ou à traiter hors code)

| # | Gravité | Constat | Décision |
|---|---|---|---|
| R1 | Faible | `npm audit` : 5 alertes hautes, toutes dans la chaîne ESLint (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` ≤ 3.0.3, ReDoS sur motifs imbriqués). `npm audit --omit=dev` : 0. Aucun correctif publié pour `braces` (3.0.3 est la dernière version). | Outillage de développement uniquement, jamais dans l'image de production ni exposé à des entrées externes. À réévaluer à chaque mise à jour de `eslint-config-next`. Ne pas appliquer `npm audit fix --force` (rétrograde en 14.x). |
| R2 | Faible | Les codes de secours 2FA sont chiffrés (cast `encrypted`, clé `APP_KEY`) et non hachés ; ils sont donc récupérables par quiconque obtient la base ET `APP_KEY`. | Accepté : la lecture seule de la base ne suffit pas. Amélioration possible : hachage Argon2 des codes (affichés une seule fois). |
| R3 | Faible | `GET /newsletter/confirm` change un état via GET (les scanners de liens d'e-mail peuvent confirmer l'abonnement). Le jeton est signé, haché en base, à usage unique et limité (20/h/IP). | Accepté ; le front peut passer par une page de confirmation. |
| I1 | Info | Le détail public d'un prestataire expose RCCM, n° d'agrément, forme juridique, capital, objet social. | Conforme à `security.md` §6 (« Public si publié ») ; l'écriture reste réservée aux demandes de modification validées. Rappel : `CLAUDE.md` §5.1.5 demande une exposition « sans nécessité » seulement. |
| I2 | Info | Le message de validation de la réponse à un avis contient « Le texte texte » (libellé d'attribut `body` dupliqué dans `lang/fr/validation.php`). | Cosmétique, non traité. |
| I3 | Info | Les routes de réponse (`/me/establishments/.../reviews/{id}/reply`) valident le corps avant de résoudre la fiche : la réponse 422 est indépendante de la propriété, aucune fuite. | Aucun. |

## Points vérifiés conformes (avec preuve)

1. **Authentification / sessions** : CSRF refusé sans `X-XSRF-TOKEN` (419) ; cookie de session `httponly; samesite=lax` ; limite 5/min sur la connexion vérifiée (6e essai = 429) ; temps de réponse identique compte connu/inconnu (~0,18 s) ; message identique pour mauvais mot de passe/compte inconnu ; `forgot-password`, `register` (compte existant), `newsletter/subscribe` et `feedbacks/track` renvoient des réponses indiscernables ; hachage factice ; régénération de session à la connexion et au changement de mot de passe ; autres sessions détruites ; 2FA TOTP avec rejet des pas rejoués, désactivation par mot de passe, interdite au staff ; inactivité staff 30 min et comptes désactivés gérés par `StaffSessionInactivity` (prioritaire sur l'authentification).
2. **Autorisations** : matrice des 110 routes relue ; `admin/*` = `can:admin-area` (admin seul) + 2FA ; `content/*` = staff (editor ou admin) + 2FA ; un utilisateur connecté reçoit 403 sur `/admin` et `/content`, un anonyme 401. IDOR : fiche, médias, justificatifs, avis, devis et réponses d'autrui renvoient 404 (testé sur 12 routes, y compris `%00` et `..%2F`). Téléchargement de justificatif : admin seul, journalisé, URL signée 5 min pour S3.
3. **Mass-assignment** : tous les modèles ont `$fillable` ; `role`, `is_active`, `status`, `user_id`, `is_verified`, `views_count` non assignables ; `PATCH /auth/profile` avec `role=admin` n'a aucun effet (rôle inchangé en base) ; champs sensibles de fiche (`name`, `rccm`…) refusés en 422 hors demande de modification.
4. **Uploads** : type réel par `finfo`, décodage et ré-encodage GD en WebP/JPEG/PNG (EXIF et charges supprimés), limite de pixels, noms ULID, PDF rejetés si contenu actif, documents sur disque privé. Test réel : SVG avec script, PNG avec `<?php`, `.php` déguisé = 422 ; un PNG contenant du PHP dans un bloc `tEXt` est livré en WebP sans la charge.
5. **XSS / HTML** : `HtmlSanitizer` par liste blanche sur analyseur HTML5 (reconstruction, pas de filtrage) ; les `img` ne peuvent référencer que la table `media` ; `dangerouslySetInnerHTML` limité à `SanitizedHtml` et `JsonLd` (échappement de `<`) ; liens externes via `ExternalLink` (http/https uniquement, `rel` sécurisé) ; réglages sociaux validés `url:https` côté API. CSP du proxy Next à nonce + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` en production. En-têtes API : nosniff, DENY, CSP `default-src 'none'`, Referrer-Policy, Permissions-Policy, HSTS en prod/staging.
6. **Injection SQL** : toutes les requêtes brutes utilisent des paramètres liés ; tris par liste blanche (`Rule::in`) ; recherche plein texte via `websearch_to_tsquery` ; `LIKE` échappé ; tables interpolées issues de listes internes uniquement. Sondes (`' OR 1=1--`, syntaxe tsquery, `%_\`, `sort=name;drop…`, bbox/lat/lng malformés) : 200 ou 422, aucun 500.
7. **SSRF / redirections / CORS / cookies** : hôtes sortants fixes (Nominatim, Turnstile, Resend) ; `safeRedirect` (refuse `//`, `\`, schémas, caractères de contrôle) utilisé dans le proxy, la page et le formulaire de connexion ; CORS en liste blanche avec credentials : origine hostile = aucun en-tête `Access-Control-Allow-Origin`.
8. **Journaux / audit** : `audit_logs` en ajout seul (trigger PostgreSQL : un `UPDATE` direct échoue, plus `REVOKE` sur le rôle applicatif) ; aucune donnée sensible dans `AuditLogger` (clés filtrées) ; IP des formulaires hachées (HMAC) ; erreurs 500 génériques avec `request_id`, jamais de trace (même avec `APP_DEBUG=true` local).
9. **Secrets** : aucun `.env` suivi par git ; `.env.example` sans valeur réelle ; recherche de motifs de secrets dans les fichiers suivis et dans l'historique (17 commits) : aucun résultat ; aucune variable `NEXT_PUBLIC_*` sensible.
10. **Dépendances** : `composer audit` : aucune alerte ; `npm audit --omit=dev` : 0 (voir R1 pour le développement).
11. **Production** : Dockerfile (utilisateur non root, `expose_php=Off`, `display_errors=Off`, OPcache sans revalidation, `APP_DEBUG=false` figé, `LOG_CHANNEL=stderr`), Caddy (`admin off`, en-têtes `Server`/`X-Powered-By` retirés), healthcheck `/up` sans information sensible, compose prod (`TRUSTED_PROXIES` obligatoire, `SESSION_SECURE_COOKIE=true`, `SESSION_ENCRYPT=true`, Turnstile activé par défaut et fermé en cas d'échec). `/.env`, `/composer.json`, `/telescope`, `/horizon` : 404 ; `/storage/logs/laravel.log` : 403 JSON.

## Risques résiduels / à faire avant la mise en ligne

1. Définir `SSR_SHARED_SECRET` sur `backend` et `web` (voir C1).
2. `TRUSTED_PROXIES` doit couvrir Cloudflare et le proxy Dockploy, sinon toutes les IP vues par Laravel sont celles du proxy et les limiteurs par IP deviennent communs à tous les visiteurs.
3. Renseigner `TURNSTILE_SECRET_KEY` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY` : sans clé, avec `TURNSTILE_ENABLED=true`, les formulaires publics échouent (fermeture sûre, mais bloquante).
4. Comptes staff : non connectés pendant les tests dynamiques (2FA confirmée sur les comptes de démo) ; leurs routes ont été couvertes par l'audit structurel et par les tests Pest, non par intrusion manuelle.
5. Non testés : charge/DoS (hors périmètre), configuration réelle de Cloudflare/Dockploy/R2 (URLs signées S3 testées seulement en logique), build de production Next (la CSP stricte à nonce a été vérifiée en code et par tests unitaires, la réponse observée venait du serveur de développement).
6. `security.md` « Points à valider » (antivirus ClamAV sur justificatifs, Cloudflare Access sur `/admin` et staging) reste ouvert : recommandé avant production.

## Fichiers modifiés ou ajoutés

Backend : `app/Providers/AppServiceProvider.php`, `app/Providers/AuthRateLimitServiceProvider.php`, `config/logging.php`, `config/services.php`, `config/session.php`, `.env.example`, `tests/Feature/RouteSecurityAuditTest.php` (nouveau), `tests/Feature/Auth/LoginTest.php`, `tests/Feature/Directory/ProvidersListTest.php`, `tests/Feature/InfrastructureTest.php`, `tests/Unit/RedactSensitiveDataTest.php`.
Web : `src/lib/api/http.ts`, `src/lib/api/server.ts`, `.env.example`, `tests/api-ssr-header.test.ts` (nouveau).
