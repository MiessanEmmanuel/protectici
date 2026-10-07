# Contrat d'API v1 — ProtectIci (phases 1 et 2)

Contrat **partagé** entre `backend/` (Laravel) et `web/` (Next.js). Source de vérité pour les formats d'échange ; le modèle de données est dans `modele.md`, les règles de sécurité dans `security.md`.

**Règle de modification** : seul le superviseur (Claude principal) modifie ce fichier. Un agent qui a besoin d'un changement le **signale dans son rapport final** (section « Écarts au contrat ») ; il ne modifie pas ce fichier.

## 1. Conventions

- Base : `{API_URL}/api/v1` (local : `http://127.0.0.1:8001/api/v1`). JSON uniquement (`Accept: application/json`).
- Auth : Sanctum SPA, **cookies httpOnly + CSRF**. Avant toute requête d'écriture : `GET {API_URL}/sanctum/csrf-cookie` (hors préfixe `/api/v1`), puis envoi de l'en-tête `X-XSRF-TOKEN` (valeur du cookie `XSRF-TOKEN`) et `credentials: 'include'`.
- Local : web `http://127.0.0.1:3000`, API `http://127.0.0.1:8001` (même hôte → cookies partagés ; on évite `localhost` car le port 8000 et les cookies `XSRF-TOKEN` de `localhost` peuvent être pris par un autre projet local). CORS en liste blanche, `supports_credentials=true`. Le serveur Next (SSR) doit envoyer `Origin`/`Referer` = origine du web, en plus du cookie, pour que Sanctum lise la session.
- Identifiants publics : **`slug`** (jamais l'`id` interne).
- Dates : ISO 8601 UTC (`2026-10-07T14:30:00Z`). Montants : entiers FCFA. Distances : mètres (`distance_m`). Coordonnées : `lat`, `lng` (nombres décimaux).
- Réponse objet : `{ "data": { … } }`. Réponse liste paginée : `{ "data": [ … ], "meta": { "current_page", "last_page", "per_page", "total" }, "links": { "next", "prev" } }`. `per_page` par défaut 12, **max 50**.
- Erreurs (toutes) : `{ "message": "Texte français générique", "errors": { "champ": ["message"] } }` — `errors` seulement pour 422. Codes : 401 non authentifié, 403 interdit, 404, 419 CSRF, 422 validation, 429 trop de requêtes (en-tête `Retry-After`), 500 générique (jamais de trace). Voir `security.md` §14, §20.
- Messages utilisateur en **français**. Noms de champs JSON en **snake_case anglais**.
- Filtres : `filter[clé]=valeur`. Tri : `sort=champ` ou `sort=-champ` (décroissant). Valeurs multiples : séparées par des virgules (`filter[service]=gardiennage-arme,videosurveillance`).

## 2. Objets

### User
`{ id, first_name, last_name, email, phone|null, role: "user"|"provider"|"editor"|"admin", email_verified: bool, two_factor_enabled: bool, created_at }`

### Référentiels
`City { id, name, slug, lat|null, lng|null, districts: [District] }` · `District { id, name, slug, parent_id|null }` · `Option { id, slug, name }` (types d'entreprise, de service, de force, de démarche).

### ProviderSummary
`{ slug, name, logo_url|null, city: {name, slug}, district: {name, slug}|null, phone, services: [{slug, name}], price_from|null, rating_avg (0–5, 1 décimale), rating_count, is_verified, is_featured, lat|null, lng|null, distance_m|null (si lat/lng fournis) }`

### ProviderDetail
`ProviderSummary` + `{ description, address|null, geo_description|null, plus_code|null, email|null, website_url|null, emergency_phone|null, socials: { facebook, instagram, twitter, linkedin, whatsapp } (valeurs ou null), company_types: [Option], legal: { legal_form|null, share_capital|null, rccm|null, approval_number|null, corporate_purpose|null }, executives: [{ full_name, position: "general_manager"|"commercial_manager"|"operations_manager"|"other", position_label|null }] (uniquement `is_visible`), gallery: [{ url, alt }], views_count, is_favorite: bool|null (null si anonyme) }`

### StateForceSummary
`{ slug, name, force_type: Option, phone|null, emergency_phone|null, city: {name, slug}, district|null, address|null, is_open_24h, lat|null, lng|null, distance_m|null }`
### StateForceDetail
`StateForceSummary` + `{ description, email|null, geo_description|null, plus_code|null, opening_hours|null, procedures: [{ slug, name, notes|null }] }`

### Review (publié uniquement, phase 2 : lecture seule)
`{ id, rating (1–5), title|null, body, author: "Prénom N." (jamais d'email), created_at, provider_reply|null, provider_replied_at|null }`

## 3. Endpoints — Phase 1 (authentification)

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | — | 204 |
| POST | `/auth/register` | `first_name, last_name, email, password, password_confirmation, phone?, consent (true obligatoire), turnstile_token?` | 201 `{data: User}` (+ email de vérification) |
| POST | `/auth/login` | `email, password, remember?` | 200 `{data: User}` **ou** 200 `{ "two_factor": true }` si 2FA requise |
| POST | `/auth/two-factor-challenge` | `code` **ou** `recovery_code` | 200 `{data: User}` |
| POST | `/auth/logout` | — | 204 |
| GET | `/auth/user` | — (auth) | 200 `{data: User}` / 401 |
| POST | `/auth/forgot-password` | `email` | 200 message **identique** que le compte existe ou non |
| POST | `/auth/reset-password` | `token, email, password, password_confirmation` | 200 |
| GET | `/auth/verify-email/{id}/{hash}` | lien signé | redirection vers `{WEB_URL}/compte?verified=1` |
| POST | `/auth/email/resend` | (auth) | 202 |
| POST | `/auth/two-factor/enable` | (auth) | 200 `{ secret, qr_svg }` |
| POST | `/auth/two-factor/confirm` | `code` | 200 `{ recovery_codes: [..] }` |
| POST | `/auth/two-factor/disable` | `password` | 204 |
| PATCH | `/auth/profile` | `first_name?, last_name?, phone?` | 200 `{data: User}` |
| PUT | `/auth/password` | `current_password, password, password_confirmation` | 204 |

Limiteurs : voir `security.md` §18. Turnstile : vérifié côté serveur si activé ; **désactivable par configuration en local et en test** (`TURNSTILE_ENABLED=false`).

## 4. Endpoints — Phase 2 (annuaire public)

| Méthode | Chemin | Paramètres | Réponse |
|---|---|---|---|
| GET | `/reference-data` | — | `{data: { cities: [City], company_types: [Option], service_types: [Option], state_force_types: [Option], procedure_types: [Option] }}` (cache HTTP court) |
| GET | `/home` | — | `{data: { stats: { providers, state_forces, service_types }, popular_providers: [ProviderSummary] (max 8) }}` |
| GET | `/providers` | `filter[q]` (nom, plein texte tolérant), `filter[city]` (slug), `filter[district]` (slug), `filter[service]` (slugs), `filter[company_type]` (slugs), `lat`, `lng`, `radius_km` (≤ 50), `sort` ∈ `name`, `-rating`, `-popular`, `distance` (exige lat/lng), `page`, `per_page` | liste paginée de `ProviderSummary` |
| GET | `/providers/popular` | `limit` (≤ 20) | `{data: [ProviderSummary]}` |
| GET | `/providers/{slug}` | — | `{data: ProviderDetail}` / 404 si non publié |
| POST | `/providers/{slug}/view` | — | 204 (compteur de vues, limité par IP/session) |
| GET | `/providers/{slug}/reviews` | `page`, `per_page` | liste paginée de `Review` publiés |
| GET | `/state-forces` | `filter[q]`, `filter[city]`, `filter[district]`, `filter[type]` (slugs), `filter[procedure]` (slugs), `lat`, `lng`, `radius_km`, `sort` ∈ `name`, `distance`, `page`, `per_page` | liste paginée de `StateForceSummary` |
| GET | `/state-forces/{slug}` | — | `{data: StateForceDetail}` |
| GET | `/map/markers` | `type` ∈ `providers`\|`state_forces`, `bbox=minLng,minLat,maxLng,maxLat`, mêmes filtres que les listes | `{data: [{ slug, name, lat, lng }]}` (max 500) |
| GET | `/geocode` | `q` (3–100 caractères) | `{data: [{ label, lat, lng }]}` (Nominatim, en cache, 1 req/s côté serveur, limiteur 30/min/IP) |
| GET | `/me/favorites` | (auth) `page` | liste paginée de `ProviderSummary` |
| PUT | `/providers/{slug}/favorite` | (auth, email vérifié) | 204 |
| DELETE | `/providers/{slug}/favorite` | (auth) | 204 |

Seuls les enregistrements `is_visible = true AND status = 'approved' AND deleted_at IS NULL` sont exposés. Recherche de proximité : `ST_DWithin` + tri par distance (fonctions SQL de `modele.md` §5.2).

## 5. Pages Next.js attendues (phases 1–2)

`/` accueil · `/annuaire` (liste + filtres + bascule liste/carte) · `/annuaire/[slug]` · `/forces-etatiques` · `/forces-etatiques/[slug]` · `/connexion` · `/inscription` (compte) · `/mot-de-passe-oublie` · `/reinitialiser-mot-de-passe` · `/compte` (profil, mot de passe, 2FA, favoris) · `/admin` (zone protégée `admin`/`editor` : simple page d'accueil de contrôle d'accès en phase 2) · pages `404` et `500`.

## 6. Écarts constatés et arbitrés (2026-10-07, après phases 1–2)

Ces points complètent le contrat ci-dessus ; ils reflètent le comportement réel, vérifié par le superviseur.
- 500 : le corps contient aussi `request_id` (et l'en-tête `X-Request-Id`). 503 sur `/geocode` si Nominatim est indisponible (`Retry-After: 30`).
- `per_page` > 50 est ramené à 50 (pas de 422). `links.next/prev` sont des URL absolues de l'API ; le front utilise `page`.
- `/map/markers` : `bbox` optionnel (500 marqueurs max) ; `type` et `filter[type]` distincts, tous deux supportés.
- Proximité : `lat`+`lng` sans `radius_km` ⇒ rayon 50 km. Tri par défaut : pertinence si `filter[q]`, sinon distance si lat/lng, sinon nom.
- `ProviderDetail.description` vaut `""` si nulle. `is_favorite` est `null` pour un anonyme.
- `PUT /favorite` : 403 « Veuillez vérifier votre adresse e-mail pour ajouter des favoris. » si e-mail non vérifié ; 404 si fiche non publiée ; `DELETE` idempotent (204).
- Auteur d'avis : « Prénom N. » (« Anonyme » si compte anonymisé).
- Login : échec = 422 `errors.email`, message identique (compte inconnu, inactif ou mot de passe faux). 2FA requise = `{"two_factor": true}` seul ; `/auth/user` = 401 tant que le challenge n'est pas réussi.
- Register : rôle toujours `user` ; l'utilisateur est connecté après inscription ; e-mail déjà pris = 422 générique.
- `email/resend` 202 `{message}` ; `reset-password` 200 `{message}` ; 2FA enable déjà confirmée 409 ; disable pour admin/editor 403 ; challenge sans login en attente 422 ; `verify-email` redirige vers `/compte?verified=1` ou `?verified=0`.
- Mots de passe : 10 caractères (user), 12 (provider/editor/admin). Cookie de session : `protectici_session`.
