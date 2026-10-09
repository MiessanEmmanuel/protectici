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
| POST | `/auth/register` | `first_name, last_name, email, password, password_confirmation, phone?, consent (true obligatoire), turnstile_token?` | **202** `{ "message": "Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte." }` — **réponse strictement identique** (corps, code, durée) que l'e-mail soit nouveau, déjà utilisé ou non vérifié. Aucune session n'est ouverte à ce stade. |
| POST | `/auth/login` | `email, password, remember?` | 200 `{data: User}` **ou** 200 `{ "two_factor": true }` si 2FA requise. Compte **non vérifié** : identifiants corrects ⇒ 403 `{message: "Veuillez confirmer votre adresse e-mail. Un nouveau lien vient de vous être envoyé."}` (nouveau lien limité à 3/heure) ; le corps contient `"code": "email_unverified"` (les autres 403 n'ont pas ce code : le front n'affiche le rappel « nouveau lien envoyé » que pour ce code) ; identifiants faux ⇒ 422 générique habituel. |
| POST | `/auth/two-factor-challenge` | `code` **ou** `recovery_code` | 200 `{data: User}` |
| POST | `/auth/logout` | — | 204 |
| GET | `/auth/user` | — (auth) | 200 `{data: User}` / 401 |
| POST | `/auth/forgot-password` | `email` | 200 message **identique** que le compte existe ou non |
| POST | `/auth/reset-password` | `token, email, password, password_confirmation` | 200 |
| GET | `/auth/verify-email/{id}/{hash}` | lien signé, expirant (60 min), à usage unique | Vérifie l'e-mail **et ouvre la session (connexion automatique)**, puis redirige vers `{WEB_URL}/compte?verified=1`. Lien invalide, expiré ou déjà utilisé : redirection vers `{WEB_URL}/connexion?verified=0`. |
| POST | `/auth/email/resend` | (auth) | 202 |
| POST | `/auth/verification/resend` | `email` (public, sans session), `turnstile_token?` | **202** `{ "message": "Si cette adresse correspond à un compte non confirmé, un nouvel e-mail vient d'être envoyé." }` — réponse identique dans tous les cas, 3 e-mails/heure/adresse et 10/heure/IP (au dépassement : même 202, aucun e-mail). Le front l'utilise pour « Renvoyer l'e-mail » (il ne conserve ni ne renvoie jamais le mot de passe). |
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
- **Register (révisé le 2026-10-07)** : réponse 202 identique dans tous les cas (anti-énumération, `security.md` §12). Nouveau compte (rôle `user`, non vérifié) ⇒ e-mail avec lien de confirmation signé ; le clic **vérifie et connecte automatiquement**. E-mail déjà utilisé et vérifié ⇒ e-mail « vous avez déjà un compte » (liens connexion / mot de passe oublié), aucun changement de compte. E-mail existant **non vérifié** ⇒ les nouvelles données (nom, mot de passe) **remplacent** les anciennes et un nouveau lien est envoyé (neutralise le détournement par pré-inscription). Les comptes non vérifiés ne peuvent pas se connecter et sont purgés après 7 jours. Limites : 5 inscriptions/heure/IP et 3 e-mails/heure/adresse destinataire (anti-bombardement). Durée de réponse égalisée (Timebox).
- `email/resend` 202 `{message}` ; `reset-password` 200 `{message}` ; 2FA enable déjà confirmée 409 ; disable pour admin/editor 403 ; challenge sans login en attente 422 ; `verify-email` redirige vers `/compte?verified=1` ou `?verified=0`.
- Mots de passe : 10 caractères (user), 12 (provider/editor/admin). Cookie de session : `protectici_session`.

---

# Phase 3 — Vague A : établissements, espace prestataire, administration

Mêmes conventions que §1 (enveloppes, erreurs, pagination, snake_case, messages en français). **Toute route ci-dessous est protégée** : `auth` (session Sanctum) + e-mail vérifié ; les routes `/admin/*` exigent en plus le rôle `admin` **et** la 2FA confirmée (`2fa.staff`), l'inactivité staff (30 min) et sont journalisées dans `audit_logs`. Le rôle `editor` n'a **aucun** accès à `/admin/*` hors blog (vague ultérieure). Autorisations par Policies (`security.md` §13) : un utilisateur ne voit/modifie que **ses** établissements (`user_id`) ; aucun ID n'est secret ; un accès à l'établissement d'autrui renvoie **404**.

Décisions : (1) l'inscription d'établissement **exige un compte connecté et vérifié** ; (2) le rôle passe à `provider` **à la première approbation** d'un de ses établissements ; (3) un utilisateur peut gérer **plusieurs** établissements ; (4) les avis ne concernent que les prestataires. `{type}` vaut `provider` ou `state_force` ; l'établissement est identifié côté propriétaire par `{type}/{slug}` et côté admin par `{type}/{id}`.

## 7.1 Objets

**MyEstablishmentSummary** : `{ type, slug, name, status: "draft"|"pending"|"approved"|"rejected"|"suspended", rejection_reason|null, is_visible, is_verified (providers), submitted_at, reviewed_at|null, pending_change_requests: int }`

**MyEstablishment** (propriétaire ; champs privés inclus) = `MyEstablishmentSummary` + tous les champs éditables du `ProviderDetail`/`StateForceDetail` (contrat §2) **sous forme d'identifiants** pour les relations (`city_id`, `district_id`, `company_type_ids[]`, `service_type_ids[]`, `force_type_id`, `procedure_type_ids[]` ou `procedures:[{procedure_type_id, notes}]`), plus `submitter_role: "manager"|"employee"|"other"|null`, `is_in_service`, `executives: [{ id, full_name, position, position_label|null, is_visible }]`, `media: [{ id, collection: "logo"|"cover"|"gallery", url, alt }]`, `documents: [{ id, type, original_name, size_bytes, uploaded_at, verified_at|null }]` (jamais d'URL publique), `change_requests: [ChangeRequest]`.

**ChangeRequest** : `{ id, changes: { champ: { old, new } }, status: "pending"|"approved"|"rejected", rejection_reason|null, created_at, reviewed_at|null }`

**AdminEstablishmentRow** : `{ type, id, slug, name, status, is_visible, is_verified, is_featured, city: {name}, owner: { id, name, email }|null, submitted_at, reviewed_at|null }`
**AdminEstablishment** = `MyEstablishment` + `{ id, owner: {id, first_name, last_name, email, phone}, is_featured, views_count, reviewed_by: {id, name}|null, audit: [{ event, user: {name}|null, created_at }] (20 derniers) }`
**AdminUser** : `{ id, first_name, last_name, email, phone|null, role, is_active, email_verified, two_factor_enabled, last_login_at|null, created_at, establishments_count }`
**AdminAuditLog** : `{ id, event, user: {id, name}|null, auditable_type, auditable_id, old_values|null, new_values|null, ip_address|null, created_at }` (jamais de mot de passe, secret ni jeton)

## 7.2 Inscription d'établissement et espace prestataire (propriétaire)

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| POST | `/establishments` | `type`; **provider** : `name, company_type_ids[] (≥1), service_type_ids[] (≥1), phone, city_id, submitter_role, is_in_service` + optionnels (`description, phone_alt, emergency_phone, email, website_url, facebook_url, instagram_url, twitter_url, linkedin_url, whatsapp_number, address, district_id, geo_description, plus_code, lat, lng, price_from, rccm, legal_form, share_capital, corporate_purpose, approval_number, approval_expires_at, executives[]`) ; **state_force** : `force_type_id, name, city_id` + optionnels (`description, phone, phone_alt, emergency_phone, email, address, district_id, geo_description, plus_code, lat, lng, opening_hours, is_open_24h, procedure_type_ids[]`) ; `consent` (true obligatoire). En-tête `Idempotency-Key` supporté (2 envois = 1 fiche). | 201 `{data: MyEstablishment}` ; statut `pending`, `is_visible=false`, `user_id` = demandeur. Limite : 3/jour/IP et 5/jour/utilisateur. |
| GET | `/me/establishments` | `page` | liste paginée de `MyEstablishmentSummary` |
| GET | `/me/establishments/{type}/{slug}` | — | `{data: MyEstablishment}` / 404 si pas propriétaire |
| PATCH | `/me/establishments/{type}/{slug}` | champs **non sensibles** (liste blanche) + `executives[]` (remplacement) | 200 `{data: MyEstablishment}` ; une tentative d'envoyer un champ sensible ⇒ 422 « Ce champ nécessite une demande de modification. » Provider sensibles : `name, rccm, legal_form, share_capital, corporate_purpose, approval_number`. State force sensibles : `name, force_type_id`. |
| POST | `/me/establishments/{type}/{slug}/change-requests` | `changes: { champ: nouvelleValeur }` (champs sensibles uniquement) | 201 `{data: ChangeRequest}` ; 409 s'il en existe déjà une `pending` |
| DELETE | `/me/establishments/{type}/{slug}/change-requests/{id}` | — | 204 (annulation tant que `pending`) |
| POST | `/me/establishments/{type}/{slug}/documents` | multipart : `file` (PDF/JPEG/PNG, ≤ 10 Mo, 5 max/fiche), `type` ∈ `approval_certificate\|rccm_extract\|id_document\|other` | 201 `{data: {id,type,original_name,size_bytes,uploaded_at}}` ; stockage **privé**, type réel vérifié par contenu, nom aléatoire |
| DELETE | `/me/establishments/{type}/{slug}/documents/{id}` | — | 204 |
| POST | `/me/establishments/{type}/{slug}/media` | multipart : `file` (JPEG/PNG/WebP/AVIF, ≤ 5 Mo), `collection` ∈ `logo\|cover\|gallery`, `alt` (obligatoire, ≤ 255) | 201 `{data: {id,collection,url,alt}}` ; image **réencodée** (EXIF/GPS supprimés, WebP, dimensions bornées), 1 logo, 1 couverture, 10 galerie max |
| DELETE | `/me/establishments/{type}/{slug}/media/{id}` | — | 204 |

Une fiche `suspended` n'est plus modifiable par le propriétaire (403). Une fiche `rejected` peut être corrigée puis **re-soumise** : `POST /me/establishments/{type}/{slug}/resubmit` ⇒ 200 (statut `pending`).

## 7.3 Administration (`/admin/*`, rôle `admin` + 2FA)

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| GET | `/admin/dashboard` | — | `{data: { pending_providers, pending_state_forces, pending_change_requests, users_total, providers_approved, state_forces_approved, recent_audit: [AdminAuditLog] (10) }}` |
| GET | `/admin/establishments` | `type?`, `status?`, `q?`, `sort` ∈ `-submitted_at\|name`, `page`, `per_page` | liste paginée de `AdminEstablishmentRow` |
| GET | `/admin/establishments/{type}/{id}` | — | `{data: AdminEstablishment}` |
| PATCH | `/admin/establishments/{type}/{id}` | tous les champs (y compris sensibles), `is_featured`, `lat`, `lng` | 200 `{data: AdminEstablishment}` |
| POST | `/admin/establishments/{type}/{id}/approve` | — | 200 ; **idempotent** : `status=approved`, `is_visible=true`, `reviewed_by/at`, rôle du propriétaire → `provider`, e-mail « fiche validée », audit. Rejouer ne renvoie pas d'e-mail. |
| POST | `/admin/establishments/{type}/{id}/reject` | `reason` (≥ 10 car.) | 200 ; `status=rejected`, `is_visible=false`, motif enregistré, e-mail, audit ; idempotent |
| POST | `/admin/establishments/{type}/{id}/suspend` | `reason` | 200 ; `status=suspended`, `is_visible=false` ; idempotent |
| POST | `/admin/establishments/{type}/{id}/restore` | — | 200 ; `suspended` → `approved`, `is_visible=true` |
| POST | `/admin/establishments/{type}/{id}/verify` · `/unverify` | — | 200 (badge `is_verified`, `verified_at`), providers uniquement |
| DELETE | `/admin/establishments/{type}/{id}` | `confirm_name` (doit égaler le nom exact) | 204 ; suppression **logique** (`deleted_at`) |
| GET | `/admin/documents/{id}/download` | — | 200 flux du fichier privé (`Content-Disposition: attachment`) ; **chaque accès est journalisé** |
| GET | `/admin/change-requests` | `status?` (défaut `pending`), `page` | liste paginée `{ id, type, establishment: {id,name}, changes, status, created_at }` |
| POST | `/admin/change-requests/{id}/approve` | — | 200 ; applique les changements (transaction), e-mail, audit ; idempotent |
| POST | `/admin/change-requests/{id}/reject` | `reason` | 200 ; e-mail, audit |
| GET | `/admin/users` | `q?`, `role?`, `is_active?`, `page` | liste paginée de `AdminUser` |
| GET | `/admin/users/{id}` | — | `{data: AdminUser}` |
| PATCH | `/admin/users/{id}` | `role?` ∈ `user\|provider\|editor\|admin`, `is_active?` | 200 ; interdit de se rétrograder/désactiver soi-même ou de retirer le **dernier admin** (422) ; audit `role_changed` |
| POST | `/admin/users/{id}/anonymize` | `confirm_email` (doit égaler l'e-mail exact) | 204 ; appelle `sp_anonymize_user` ; audit |
| GET | `/admin/reference/{resource}` | `resource` ∈ `cities\|districts\|company-types\|service-types\|state-force-types\|procedure-types\|feedback-topics\|post-categories` ; `page` | liste (incluant les valeurs `is_visible=false`) |
| POST · PATCH | `/admin/reference/{resource}` · `/{id}` | champs du référentiel (`name`, `slug` auto, `sort_order`, `is_visible`, `description`, ville : `lat`,`lng` ; quartier : `city_id`,`parent_id`) | 201 / 200 |
| DELETE | `/admin/reference/{resource}/{id}` | — | 204 ; **409** « Valeur utilisée, masquez-la plutôt. » si référencée |
| GET | `/admin/audit-logs` | `event?`, `user_id?`, `auditable_type?`, `from?`, `to?`, `page` | liste paginée de `AdminAuditLog` (lecture seule) |
| GET | `/admin/notifications` · POST `/admin/notifications/{id}/read` | — | notifications internes (nouvelle fiche, demande de modification) |

Notifications internes créées : nouvelle inscription d'établissement, nouvelle demande de modification, nouveau justificatif.

## 7.4 E-mails (Resend)

Package `resend/resend-php` (ou transport Laravel compatible) pour staging/production ; `log` en local. Modèles en français : fiche reçue (accusé au demandeur), fiche validée, fiche rejetée (avec motif), fiche suspendue, demande de modification approuvée/rejetée. Aucun e-mail n'est envoyé deux fois pour une action rejouée.

## 7.5 Pages Next.js (vague A)

`/inscription-etablissement` (formulaire multi-étapes, compte connecté et vérifié requis ; sinon invitation à se connecter/inscrire) · `/espace-prestataire` (mes établissements + statut) · `/espace-prestataire/[type]/[slug]` (édition, dirigeants, médias, justificatifs, demandes de modification, re-soumission) · `/admin` (tableau de bord) · `/admin/etablissements` · `/admin/etablissements/[type]/[id]` (détail + actions approuver/rejeter/suspendre/vérifier/supprimer) · `/admin/modifications` · `/admin/utilisateurs` · `/admin/referentiels` · `/admin/journal`. Interface neutre à base de jetons (design différé).

---

# Phase 3 — Vague B : avis, « Dis-moi tout », devis, contact, antispam

Mêmes conventions que §1 et §7. Les formulaires **publics** (feedbacks, devis, contact) sont ouverts aux visiteurs (compte facultatif : si une session existe, `user_id` est rattaché). **Aucune donnée personnelle dans l'URL ni les logs** ; messages utilisateur en français.

## 8.0 Antispam commun aux formulaires publics

- Corps : `turnstile_token?` (exigé seulement si `TURNSTILE_ENABLED=true` ; désactivé en local/test) et un champ **piège** `company_website` (doit rester vide ; rempli ⇒ réponse **succès simulée identique** mais **rien n'est enregistré ni envoyé**).
- En-tête `Idempotency-Key` (UUID) supporté : deux envois identiques = un seul enregistrement.
- Consentement : `consent: true` obligatoire ⇒ `consent_at` + `consent_logs` (finalités `feedback`, `quote`, `contact`).
- Limites (security.md §18) : feedbacks et devis 5/h/IP et 10/jour/e-mail ; contact 5/h/IP ; avis 10/jour/utilisateur ; suivi de dossier 10/h/IP et 5/h/référence.
- E-mails : **envoyés en file d'attente** (driver `database`, `php artisan queue:work`), jamais en double ; l'échec d'envoi n'annule pas l'enregistrement.

## 8.1 Avis

**Review (publique)** : voir §2. **MyReview** : `{ id, provider: {slug, name}, rating, title|null, body, status: "pending"|"approved"|"rejected", rejection_reason|null, is_visible, created_at, provider_reply|null }`.

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| POST | `/providers/{slug}/reviews` | `rating` (1–5), `title?` (≤150), `body` (10–3000) — auth + e-mail vérifié | 201 `{data: MyReview}` (`pending`, non publié) ; **409** « Vous avez déjà donné un avis pour ce prestataire. » ; 404 si fiche non publiée ; un propriétaire ne peut pas noter sa propre fiche (403) |
| GET | `/me/reviews` | `page` | liste paginée de `MyReview` |
| PATCH | `/me/reviews/{id}` | `rating?`, `title?`, `body?` | 200 `{data: MyReview}` ; **repasse en `pending`** et masqué ; 404 si pas l'auteur |
| DELETE | `/me/reviews/{id}` | — | 204 (suppression logique ; la note moyenne est recalculée) |
| POST | `/reviews/{id}/report` | `reason` ∈ `spam\|offensive\|false_info\|other`, `details?` — auth | 204 ; 1 signalement par utilisateur et avis (rejeu = 204) ; avis non publié = 404 |
| GET | `/me/establishments/provider/{slug}/reviews` | `status?`, `page` — propriétaire | liste paginée `{ id, rating, title, body, author: "Prénom N.", status, created_at, provider_reply|null, provider_replied_at|null }` |
| POST | `/me/establishments/provider/{slug}/reviews/{id}/reply` | `body` (5–1500) — propriétaire | 200 ; **une seule réponse** par avis (409 ensuite) ; avis non `approved` = 404 ; e-mail à l'auteur |
| GET | `/admin/reviews` | `status?` (défaut `pending`), `provider?`, `q?`, `page` | liste paginée `AdminReviewRow` |
| POST | `/admin/reviews/{id}/approve` · `/reject` | `/reject` : `reason` (≥10) | 200 ; idempotent ; `approved` ⇒ `is_visible=true` ; la note moyenne du prestataire est recalculée (trigger) ; e-mail à l'auteur ; audit |
| DELETE | `/admin/reviews/{id}` | — | 204 (logique) ; audit |
| GET | `/admin/review-reports` | `status?` (défaut `open`), `page` | liste paginée `AdminReviewReport` |
| POST | `/admin/review-reports/{id}/accept` · `/dismiss` | — | 200 ; `accept` masque l'avis (`is_visible=false`, `rejected`) ; idempotent ; audit |

**AdminReviewRow** : `{ id, provider: {id, slug, name}, author: {id, name, email}|null, rating, title|null, body, status, is_visible, reports_count, created_at }` · **AdminReviewReport** : `{ id, review: {id, rating, body_excerpt, provider_name}, reporter: {id, name}|null, reason, details|null, status: "open"|"accepted"|"dismissed", created_at }`.

## 8.2 « Dis-moi tout » (feedbacks)

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| POST | `/feedbacks` | `civility?` ∈ `M.\|Mme\|Mlle`, `last_name`, `first_name`, `email`, `phone?`, `provider_slug?`, `action_type` ∈ `encouragement\|question\|complaint\|suggestion`, `target_type` ∈ `employee\|product\|service`, `service_type_id?`, `topic_id?`, `product_type?`, `location?`, `comment` (10–3000), `consent`, + antispam §8.0. Règles : `topic_id` requis si `target_type` ≠ `product` ; `service_type_id` requis si `service`. | 201 `{data: { reference: "DMT-2026-000123", status: "new", message: "Votre message a bien été reçu. Conservez ce numéro de suivi." }}` ; accusé e-mail (avec la référence) |
| POST | `/feedbacks/track` | `reference`, `email` (**POST**, jamais en URL) | 200 `{data: { reference, status, created_at, provider_name|null, replies: [{ body, created_at }] (réponses NON internes seulement) }}` ; **404 générique** « Aucun dossier ne correspond à ces informations. » que la référence soit inconnue ou l'e-mail faux |
| GET | `/admin/feedbacks` | `status?`, `action_type?`, `provider?`, `assigned_to?`, `q?` (référence/nom/e-mail), `sort` ∈ `-created_at\|status`, `page` | liste paginée `AdminFeedbackRow` |
| GET | `/admin/feedbacks/{id}` | — | `{data: AdminFeedback}` |
| PATCH | `/admin/feedbacks/{id}` | `status?` ∈ `new\|in_progress\|forwarded\|resolved\|closed`, `assigned_to?` (id admin ou null) | 200 ; `resolved_at` posé à la résolution ; audit |
| POST | `/admin/feedbacks/{id}/replies` | `body` (≥5), `is_internal` (bool) | 201 ; si `is_internal=false` : e-mail envoyé à l'auteur (une fois) ; sinon note interne |

**AdminFeedbackRow** : `{ id, reference, author: {first_name, last_name, email}, provider: {id, name}|null, action_type, target_type, status, assigned_to: {id, name}|null, created_at }` · **AdminFeedback** = row + `{ civility|null, phone|null, service_type: Option|null, topic: Option|null, product_type|null, location|null, comment, consent_at, resolved_at|null, replies: [{ id, author: {id,name}|null, body, is_internal, sent_at|null, created_at }] }`.

## 8.3 Devis

| Méthode | Chemin | Corps / paramètres | Réponse |
|---|---|---|---|
| POST | `/quote-requests` | `first_name`, `last_name`, `email`, `phone`, `company_name?`, `service_type_id`, `city_id`, `district_id?`, `description` (20–3000), `desired_start_date?` (≥ aujourd'hui), `budget_range?` (≤50), `provider_slugs?` (≤ 5 prestataires publiés), `consent`, + antispam | 201 `{data: { reference: "DEV-2026-000123", message }}` ; accusé e-mail ; si `provider_slugs` fourni : un destinataire par prestataire (`sent`) + e-mail à chacun + statut `sent` ; sinon statut `new` (à acheminer par l'admin) |
| GET | `/me/quote-requests` | `status?`, `page` — propriétaire d'au moins une fiche | liste paginée de `ProviderQuote` (devis **adressés à ses fiches** uniquement) |
| GET | `/me/quote-requests/{id}` | — | `{data: ProviderQuote}` ; passe le destinataire à `viewed` (idempotent) ; 404 si non destinataire |
| POST | `/me/quote-requests/{id}/reply` | `message` (10–3000), `quoted_amount?` (entier FCFA ≥ 0) | 200 ; destinataire `replied` ; e-mail au demandeur ; une seule réponse (409 ensuite) |
| POST | `/me/quote-requests/{id}/decline` | `reason?` | 200 ; destinataire `declined` |
| GET | `/admin/quote-requests` | `status?`, `q?`, `page` | liste paginée `AdminQuoteRow` |
| GET | `/admin/quote-requests/{id}` | — | `{data: AdminQuote}` |
| POST | `/admin/quote-requests/{id}/dispatch` | `provider_ids[]` (1–5 fiches publiées) | 200 ; crée les destinataires manquants (idempotent, pas de doublon), e-mails, statut `sent` |
| PATCH | `/admin/quote-requests/{id}` | `status` ∈ `new\|sent\|answered\|closed\|cancelled` | 200 ; audit |

**ProviderQuote** : `{ id, reference, requester: { name, email, phone, company_name|null }, service: Option, city: {name}, district: {name}|null, description, desired_start_date|null, budget_range|null, status: "sent"|"viewed"|"replied"|"declined", sent_at, viewed_at|null, replied_at|null, response_message|null, quoted_amount|null }` (les coordonnées du demandeur ne sont visibles que du prestataire destinataire et de l'admin).
**AdminQuoteRow** : `{ id, reference, requester_name, requester_email, service: Option, city: {name}, status, recipients_count, created_at }` · **AdminQuote** = row + `{ phone, company_name|null, description, desired_start_date|null, budget_range|null, recipients: [{ id, provider: {id, name}, status, sent_at, viewed_at|null, replied_at|null, response_message|null, quoted_amount|null }] }`.

## 8.4 Contact

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| POST | `/contact` | `name`, `email`, `subject` (≤200), `message` (10–5000), `consent`, + antispam | 201 `{data: { message: "Merci, votre message a bien été envoyé." }}` ; accusé e-mail ; notification interne admin |
| GET | `/admin/contact-messages` | `status?` (défaut `new`), `q?`, `page` | liste paginée `{ id, name, email, subject, message, status: "new"\|"read"\|"answered"\|"archived", handled_by: {id,name}\|null, handled_at\|null, created_at }` |
| PATCH | `/admin/contact-messages/{id}` | `status` | 200 ; audit |
| POST | `/admin/contact-messages/{id}/reply` | `body` (≥5) | 200 ; e-mail à l'auteur (une fois) ; statut `answered` |

## 8.5 Tableau de bord (extension de `/admin/dashboard`)

Ajoute à `data` : `pending_reviews`, `open_review_reports`, `new_feedbacks`, `new_quote_requests`, `new_contact_messages`.

## 8.6 Rétention (jobs planifiés, `modele.md` §5.3)

Commandes artisan planifiées quotidiennes et testées : purge des clés d'idempotence (> 48 h), des `contact_messages` (> 12 mois), anonymisation des `feedbacks` (> 36 mois après clôture) et des `quote_requests` (> 24 mois), suppression physique des justificatifs et médias des fiches supprimées/anonymisées (> 30 jours). Toutes journalisées dans `audit_logs`, sans données personnelles.

## 8.7 Pages Next.js (vague B)

Publiques : `/dis-moi-tout` (formulaire multi-étapes + écran de confirmation avec référence) · `/dis-moi-tout/suivi` (référence + e-mail) · `/devis` (formulaire ; `?prestataire=slug` pré-sélectionne un prestataire, lien depuis les fiches) · `/contact` · fiche prestataire : **avis réels paginés + formulaire d'avis** (étoiles, titre, texte ; état « en attente de modération » ; modifier/supprimer son avis ; signaler un avis). Compte : `/compte/mes-avis`. Espace prestataire : onglets/pages **« Avis reçus »** (réponse unique) et **« Devis reçus »** (liste, détail, répondre/décliner). Admin : `/admin/avis` (avis + signalements) · `/admin/dis-moi-tout` (liste, détail, réponses, statut, affectation) · `/admin/devis` (liste, détail, acheminement) · `/admin/messages` (contact) · compteurs du tableau de bord. Composant **Turnstile** (script Cloudflare chargé seulement si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est défini, CSP ajustée en conséquence) + champ piège invisible sur tous les formulaires publics. Les pages « Bientôt disponible » `dis-moi-tout`, `devis`, `contact` sont **retirées**.
