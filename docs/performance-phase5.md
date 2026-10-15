# Performance — phase 5

Date : 2026-10-15. Périmètre : API Laravel 13 (`backend/`), Next.js 16 (`web/`), PostgreSQL 18 + PostGIS.

## Méthode

- Base dédiée **`protectici_perf`** (`createdb`, extensions + migrations), jamais `protectici_dev` ni `protectici_test`. Jeu de charge généré par `php artisan app:seed-load` (5 000 prestataires dont 250 en attente, 800 forces étatiques, 20 000 avis, 3 000 articles, 1 000 utilisateurs, 7 500 médias). La commande est **séparée** de `DemoSeeder`, refuse la production et toute base dont le nom ne contient pas « perf » (sauf `--force`) ; trois tests Pest le vérifient.
- Plans : `EXPLAIN (ANALYZE, BUFFERS)` sur `protectici_perf`, exécutions « chaudes » (médiane de 2 à 3 passes ; la première passe, froide, est 2 à 10 fois plus lente et n'est pas retenue). Les tables ont été compactées (`VACUUM FULL ANALYZE`) après le chargement pour supprimer le gonflement dû aux `UPDATE` du seeder.
- Temps de réponse : `curl -w %{time_total}`, 20 requêtes séquentielles par endpoint (+1 d'échauffement), contre `php artisan serve` (4 workers, **sans OPcache**) sur le port 8011 pointant sur `protectici_perf`, en-tête `X-SSR-Secret` pour ne pas dépendre du limiteur 60/min. Le plancher de ~12-13 ms correspond au démarrage du framework sans OPcache (`/reference-data` en cache, `/home`). En production (OPcache, workers PHP-FPM) les valeurs absolues seront plus basses ; seuls les écarts avant/après sont significatifs.
- Aucun test de charge : ≈ 600 requêtes séquentielles au total.

## 1. Base de données

Index ajoutés (migration additive `2026_10_15_100001_add_performance_indexes`, testée sur base vierge et appliquée sur `protectici_dev` par `php artisan migrate`) : index partiels `WHERE is_visible AND status='approved' AND deleted_at IS NULL` alignés sur les tris des listes publiques.

| Index | Sert |
|---|---|
| `providers_public_name_idx (name, id)` | annuaire, tri par défaut (nom), pagination profonde |
| `providers_public_popular_idx (is_featured DESC, rating_avg DESC, rating_count DESC, views_count DESC, id)` | populaires (accueil, `/providers/popular`, `sort=-popular`) |
| `providers_public_rating_idx (rating_avg DESC, rating_count DESC, name, id)` | `sort=-rating` |
| `state_forces_public_name_idx (name, id)` | forces étatiques, tri par défaut |

| Requête (5 000 prestataires) | Avant | Après | Plan après |
|---|---|---|---|
| Annuaire page 1, tri nom | 3,75 ms (Seq Scan + tri top-N, 3 467 tampons non compactés) | **0,026 ms** | Index Scan `providers_public_name_idx` |
| Annuaire page profonde (OFFSET 4 000) | 38,1 ms (Parallel Seq Scan + tri externe sur disque) | **0,69 ms** | Index Scan, pas de tri |
| Populaires (accueil) | 1,69 ms | **0,024 ms** | Index Scan `providers_public_popular_idx` |
| Forces étatiques, liste tri nom | 1,16 ms | **0,020 ms** | Index Scan |
| Admin : liste des établissements (UNION providers + state_forces) | 10,4 à 18,0 ms (médiane 11,6) | **≈ 4,5 ms** | plus de sous-requête corrélée sur 5 800 lignes |

Changement de code associé : `EstablishmentQueries::admin()` calculait `pending_change_requests` (sous-requête corrélée) pour **chaque** ligne de l'UNION avant pagination, alors que la liste d'administration n'expose pas ce champ. Il n'est plus calculé que pour l'espace « mes établissements » qui l'affiche.

Requêtes examinées sans changement nécessaire (déjà sur index ou volumes sans enjeu) :

| Requête | Temps (ms) | Plan |
|---|---|---|
| Compte annuaire publié | 1,3 | Seq/Index Only Scan, 4 750 lignes |
| Ville + service (COUNT et page tri note) | 0,3 à 0,9 | Index `provider_service_type_rev_idx` + `providers_pkey` |
| Fiche prestataire (slug) | 0,04 | `providers_slug_uq` ; relations chargées en 6 requêtes constantes (ville, services, types, dirigeants, galerie, logo) |
| Avis d'une fiche | 0,07 | `reviews_provider_public_idx` |
| Blog : liste, populaires, à la une, flash | 0,03 à 0,38 | `posts_public_idx`, `posts_popular_idx`, `posts_flash_idx` |
| Blog : compteurs par catégorie | 1,2 | Seq Scan sur 3 000 lignes (acceptable) |
| Dashboard admin (13 compteurs) | 0,04 à 3,0 chacun | `providers_status_idx`, `reviews_status_idx` ; `users` et `approved` en Seq Scan sans enjeu |
| Proximité prestataires (10 km, **1 338** fiches dans le rayon) | 13 à 20 ms | GiST `providers_location_gist` + BitmapAnd ; le coût est celui de `ST_DWithin` sphéroïdal par ligne candidate (≈ 10 µs) |

N+1 : `Model::preventLazyLoading` est actif hors production et la suite entière tourne dessus ; un test (`garde un nombre de requêtes SQL borné…`) vérifie que le nombre de requêtes de la liste ne dépend pas de la taille de la page (≤ 12 dont ~5 de limiteur).

## 2. API

### Cache des réponses publiques

- Middleware `public.cache:{espace},{ttl}` (`App\Http\Middleware\CachePublicResponse`) sur les GET publics : `reference-data` (300 s), `home`, `providers` (liste, populaires, fiche, avis), `state-forces` (liste, fiche), `map/markers` (60 s, espace `directory`) ; `blog/categories` (120 s), `blog/flash`, `blog/posts` (60 s, espace `blog`) ; `pages/{slug}`, `partners`, `settings/public` (300 s, espace `site`).
- Clés versionnées (`App\Support\PublicCache`) : `pubcache:{espace}:{jeton}:{sha1(hôte+chemin+requête triée)}`. Le jeton est renouvelé (valeur aléatoire, sans course) à chaque `saved/deleted/restored` des modèles de l'espace (Provider, StateForce, Review, référentiels, ProviderExecutive pour `directory` ; Post, PostCategory, PostComment pour `blog` ; Page, Partner, Setting pour `site` ; Media pour tous). Écritures SQL directes (compteurs de vues) : absorbées par le TTL court.
- En-têtes : `Cache-Control: public, max-age={ttl}`, `ETag` faible (sha1 du corps), `If-None-Match` → **304** sans corps, `Vary: Cookie, Authorization`.
- **Jamais pour l'authentifié** : lecture ET écriture du cache contournées si un utilisateur est résolu (session Sanctum ou garde par défaut) ou si l'en-tête `Authorization` est présent ; ces réponses gardent `no-store, private` (`SecurityHeaders`). Seules les réponses 200 JSON ≤ 512 Ko sont stockées ; seul le corps est conservé (jamais d'en-tête ni de cookie). Requêtes à chaîne de paramètres > 400 caractères : pas de mise en cache (anti-amplification). Les routes à effet de bord (`blog/posts/{slug}` qui compte la vue, `providers/{slug}/view`, favoris, commentaires, géocodage) ne sont pas mises en cache.
- `cache:purge-expired` (horaire) : le magasin `database` ne supprime une entrée expirée qu'à la relecture, les clés par combinaison de paramètres s'accumuleraient sinon.
- Interrupteur : `PUBLIC_CACHE_ENABLED=false`.
- Tests : `tests/Feature/Performance/PublicCacheTest.php` (cache hit sans requête SQL, 304, invalidation fiche/avis/blog/jeton, absence de fuite entre anonyme et connecté dans les deux sens, `Authorization`, erreurs non cachées, ordre des paramètres, page distincte, nombre de requêtes borné, désactivation, paramètres démesurés, purge) et `SeedLoadCommandTest.php`.

### Temps de réponse (médiane / p95 sur 20 requêtes, ms)

« Avant » : code initial + `protectici_perf`. « Après (cache) » : lecture servie par le cache. « Après (miss) » : URL unique (`&zz=…`) donc cache manqué, avec les index et le code optimisé.

| Endpoint | Avant | Après (cache) | Après (miss) |
|---|---|---|---|
| `/home` | 29 / 32 | **13 / 15** | 37 / 78 |
| `/providers?per_page=12` | 34 / 35 | **16 / 18** | 37 / 40 |
| `/providers?filter[q]=securite` (texte) | 52 / 57 | **17 / 66** | 61 / 69 |
| `/providers?filter[q]=garde&city&service` | 36 / 37 | **16 / 17** | 42 / 47 |
| `/providers?lat&lng&radius_km=10` (proximité) | 44 / 46 | **16 / 18** | 49 / 55 |
| `/providers/{slug}` | 25 / 26 | **24 / 27** | 29 / 32 |
| `/state-forces?lat&lng&radius_km=10` | 34 / 36 | **15 / 19** | 49 / 76 |
| `/blog/posts?per_page=12` | 24 / 27 | **16 / 19** | 28 / 33 |
| `/blog/posts?sort=popular` | 22 / 27 | **16 / 20** | 29 / 32 |
| `/reference-data` | 12 / 15 | 16 / 45 | 17 / 45 |

Lecture : le gain de wall-clock vient du cache (≈ 2 fois moins sur les listes, moins en réalité car le plancher du serveur de dev domine) ; la voie « miss » est équivalente ou légèrement supérieure (écriture de l'entrée, bruit de machine) car à ce volume le temps SQL (0,03 à 20 ms) est faible devant le démarrage du framework ; l'intérêt des index se voit aux plans (tableau §1) et croît avec le volume. `/reference-data` et la fiche détaillée n'ont pas gagné (déjà en cache applicatif / première requête de liaison de route).

Limites connues du protocole : mesures sur machine de développement partagée, bruit de ±5 à 10 ms ; `php artisan serve` n'est pas représentatif d'un PHP-FPM + OPcache.

## 3. Front (Next.js)

- **Build sans API** : `NEXT_DIST_DIR=.next-perf NEXT_PUBLIC_API_URL=http://127.0.0.1:59999 npm run build` réussit API arrêtée (47 pages générées, toutes les routes sont dynamiques `ƒ` à cause du nonce CSP du proxy, aucun prérendu ne contacte l'API). Aucun `ECONNREFUSED`, donc aucune correction `force-dynamic` n'a été nécessaire (`robots.ts` et `sitemap.ts` le sont déjà). Conséquence à connaître : ISR/`revalidate` de page n'est pas compatible avec la CSP à nonce ; le cache se fait au niveau des `fetch` (cache de données Next).
- **JS de première charge** (gzip, partagé 128 kB inclus ; mesure sur `build-manifest` + `entryJSFiles`) :

| Route | Avant | Après |
|---|---|---|
| `/qui-sommes-nous`, `/blog`, pages éditoriales | 210,8 kB | **147,0 kB** |
| `/annuaire`, `/forces-etatiques` | 215,8 kB | **152,0 kB** |
| `/annuaire/[slug]` (fiche) | 220,1 kB | **186,9 kB** |
| `/blog/[slug]` | 213,7 kB | **181,5 kB** |
| `/contact` | 214,4 kB | **181,0 kB** |
| `/connexion` | 212,5 kB | **179,4 kB** |
| `/admin` | 217,1 kB | **153,4 kB** |
| `/admin/blog/nouveau` | 219,0 kB | **186,7 kB** |

  Deux causes corrigées, présentes dans le layout racine donc sur **toutes** les pages : (1) `clientApi` importait statiquement les données factices (`mocks/mock-api`, ≈ 38 kB gzip) même avec `NEXT_PUBLIC_USE_MOCKS=0` ; remplacé par une façade chargée à la demande (`lib/mocks/lazy-mock-api.ts`, compatible `vi.spyOn`), idem pour le bouton de démonstration de `RegisterForm` ; (2) `NewsletterForm` (pied de page) importait zod (≈ 31 kB gzip) ; schémas et validation sont maintenant importés au premier envoi (avec garde anti double envoi avancée avant l'import).
- Déjà conformes : Leaflet/cartes en `next/dynamic` (`MiniMap`, `DynamicMap`, `MapPicker`), polices système (aucune police web), images avec dimensions + `loading="lazy"`/`decoding="async"`, `<img>` plutôt que `next/image` pour une raison CSP documentée (style en ligne), éditeur riche maison sans dépendance externe (la page admin `/admin/blog/nouveau` ne dépasse pas 187 kB), `metadata`/`generateMetadata` sur les fiches. Ajout : `fetchPriority="high"` sur l'image de couverture d'un article (LCP).
- **Cache de données** : `http.ts` pose désormais `next.tags` (`directory`, `blog`, `site` + segment) sur les lectures publiques anonymes (mêmes espaces que l'API, prêt pour `revalidateTag`), jamais avec le cookie de session (`cache: 'no-store'`, inchangé) ni sur les écritures. TTL alignés : accueil et populaires 120 → 60 s pour correspondre au TTL API (staleness maximale cumulée Next + API ≈ 2 min pour les listes, ≈ 10 min pour les référentiels).
- Tests Vitest ajoutés : `tests/api-cache-tags.test.ts` (5 cas).

## 4. Suites finales

| Suite | Résultat |
|---|---|
| Pest | **626 passés** (5 023 assertions) — 606 + 20 nouveaux |
| Pint | propre |
| Larastan niveau 6 | aucune erreur |
| Vitest | **364 passés** (40 fichiers) — 359 + 5 nouveaux |
| `tsc --noEmit` | propre |
| ESLint | propre |

## 5. Dettes et recommandations

1. **Magasin de cache `database`** : chaque requête limitée coûte ~5 requêtes SQL (lecture, minuterie, verrou, mise à jour) et le cache public s'y stocke aussi. Un Redis (ou APCu pour un seul conteneur) réduirait la latence de toutes les routes ; un essai avec le magasin `file` pour les seuls limiteurs n'a pas donné de gain mesurable en développement.
2. **Recherche texte annuaire** (`filter[q]`) : le prédicat `OR` (plein texte, `word_similarity(unaccent(…))`, `unaccent(name) ILIKE`) force un Seq Scan (≈ 6 ms à 5 000 lignes, linéaire). Au-delà de ~50 000 fiches : fonction `unaccent` immuable, index trigramme sur `unaccent(name)` et opérateur `<%` à la place de `word_similarity(...) >= 0,5` (changement sémantique du seuil à valider).
3. **Proximité** : `ST_DWithin` sphéroïdal coûte ≈ 10 µs par ligne candidate ; en mode sphère (`use_spheroid=false`) le temps est divisé par 2 à 5 pour un écart de bord de 0,3 %, non appliqué car il modifie la sémantique du rayon. Le COUNT et la page appellent deux fois `fn_providers_nearby`.
4. **Pagination OFFSET** : plus coûteuse seulement sans index de tri ; avec les nouveaux index une page à l'offset 4 000 coûte 0,7 ms. Pagination keyset non justifiée aujourd'hui.
5. **Fiche prestataire** : zod (~33 kB gzip) reste dans `/annuaire/[slug]` à cause des formulaires d'avis/contact ; chargement différé du formulaire d'avis possible.
6. **Noms d'auteurs d'avis** : un changement de nom d'utilisateur n'invalide pas le cache (TTL 60 s). Les pivots (`provider_service_type`) modifiés sans sauvegarde du modèle de la fiche non plus.
7. **Création d'index en production** : la migration crée les index sans `CONCURRENTLY` (verrou court, acceptable à ce volume) ; sur une base volumineuse, les créer à la main avec `CONCURRENTLY` avant le déploiement (`IF NOT EXISTS` rend la migration idempotente).
8. **Mesures** : à refaire sur staging (PHP-FPM + OPcache, Cloudflare) pour des budgets de production. Les serveurs de mesure démarrés pour cette tâche (`artisan serve` sur 8011 et 8012, base `protectici_perf`) sont laissés actifs : à arrêter à la main.
