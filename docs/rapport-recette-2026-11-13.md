# Rapport de recette consolidé — ProtectIci (13/11/2026)

> Campagne menée par 6 testeurs IA (suites automatisées, front-office, espace client, espace prestataire, back-office, sécurité/API), puis vérifiée par le chef d'équipe.
> Environnement : API Laravel `http://127.0.0.1:8002`, front Next.js `http://127.0.0.1:3003` (`next dev`), base `protectici_dev` seedée le 12/11 à 23:51, branche `main` @ `2d3581c` **avec 190 entrées non commitées** (116 fichiers modifiés, 74 non suivis).
> Rapports bruts et scripts : `/private/tmp/claude-501/-Users-macbookpro-Desktop-projets-protectici/69635cc1-9468-452d-9c48-0a57cf8d6be6/scratchpad/reports/` et `.../scratchpad/<testeur>/`. Scripts de contre-vérification du chef : `.../scratchpad/chef/`.

---

## 1. Synthèse

| Espace | Verdict | En une phrase |
|---|---|---|
| Front-office (visiteur) | ⚠️ | Parcours public solide (annuaire, carte, proximité, blog, formulaires, 404, a11y clavier). Mais toute fiche de force étatique **avec horaires** renvoie une erreur 500, et le compteur de vues du blog est faussé. |
| Espace client | ✅ | Inscription, vérification, connexion, 2FA, réinitialisation, avis, favoris, devis, Dis-moi tout et revendication fonctionnent. Il reste des défauts d'ergonomie mineurs (formulaires réaffichés, pas de préremplissage). |
| Espace prestataire | ❌ | **Répondre à un avis par l'interface est impossible** (formulaires imbriqués). **La page de gestion d'une force étatique plante.** Les horaires bloquent l'inscription d'une administration. Les devis, les demandes de modification et les médias fonctionnent. |
| Back-office | ❌ | La modération, les revendications, les utilisateurs, les référentiels et le journal d'audit fonctionnent. Mais **la réponse e-mail « Dis-moi tout » n'est jamais envoyée**, **l'éditeur riche détruit la mise en forme** des contenus existants, **le détail admin d'une force avec horaires plante** et **l'import Excel n'a pas d'API**. |
| API / sécurité | ⚠️ | Les contrôles tiennent : autorisations (matrice de 151 routes × 5 rôles), CSRF, CORS, IDOR, mass assignment, XSS, uploads, énumération, throttling, en-têtes, expiration de session. Deux problèmes restent : des **500 sur les ID > PHP_INT_MAX**, et des **dépendances vulnérables** (Next.js critique, Symfony). |
| Suites automatisées | ⚠️ | Pest : 709/709 ✅. ESLint ✅. Vitest : 1 fichier cassé, typecheck : 15 erreurs, Larastan : 2 erreurs, Pint : 3 fichiers. Tous ces échecs viennent de **changements non commités**. |

**Constat transversal important :** une partie des défauts vient des changements non commités, pas du code commité :
- la régression de l'éditeur riche (`innerHTML` → `textContent`) ;
- le fichier de test corrompu ;
- le module d'import inachevé.

Il faut d'abord **faire le tri dans l'arbre de travail** (commit par lots ou branche) avant de corriger.

---

## 2. Bugs consolidés (triés par gravité)

Légende des verdicts :
- **CONFIRMÉ (rejoué)** : je l'ai reproduit moi-même.
- **CONFIRMÉ (code)** : cause lue dans le code, sans nouveau rejeu ; la preuve du testeur est jugée suffisante.
- **NON VÉRIFIÉ** : repris du testeur tel quel.

Origine des signalements : FO = front-office, EC = espace client, EP = espace prestataire, BO = back-office, SEC = sécurité/API, S = suites.

### 2.1 Bloquants

| id | Gravité | Espace | Titre | Cause racine (fichier:ligne) | Reproduction courte | Verdict du chef | Correctif suggéré |
|---|---|---|---|---|---|---|---|
| R01 | BLOQUANT | Prestataire + back-office | Formulaires imbriqués : un `ConfirmDialog` est rendu **dans** un `<form>`. Conséquence : réponse à un avis impossible par l'UI (EP-B3), réponse e-mail « Dis-moi tout » jamais envoyée (BO-03) | `ConfirmDialog` contient son propre `<form>`, et `Modal` est un `<dialog>` sans portail. Il est placé dans `web/src/components/provider-space/ReviewsReceived.tsx:260-285` et `web/src/components/admin/feedback/FeedbackDetail.tsx:345-384`. Recherche systématique : ce sont **les 2 seules** occurrences imbriquées sur 20 utilisations | `/espace-prestataire/avis` → saisir une réponse → « Répondre à cet avis » → « Publier la réponse » : la page se recharge en `GET /espace-prestataire/avis?`, sans aucun POST | **CONFIRMÉ (rejoué)** avec `09b-reply-debug.js` à 1280 px : soumission native GET, avertissement React « <form> cannot be a descendant of <form> », avis 146 toujours sans réponse en base. BO-03 : même cause, même structure | Sortir le `ConfirmDialog` du `<form>` (fragment frère), comme dans `QuotesReceived.tsx` |
| R02 | BLOQUANT | Front-office, prestataire, back-office | Le format des **horaires d'ouverture** n'est pas le même au front et à l'API. Symptômes : fiche publique d'une force avec horaires en 500 (FO-B1) ; inscription d'une administration avec horaires en 422 (FO-B2, EP-B2) ; PATCH de la fiche en 422 ; **détail admin d'une force avec horaires qui plante** (nouveau, trouvé par le chef) | API et `modele.md` : JSON structuré `{"mon":[["08:00","17:00"]]}` (`backend/app/Support/Establishments/EstablishmentSchema.php:176`, règle `array` + `validOpeningHours`). Front : `string` (`web/src/lib/api/types.ts:150,380,568`), champ texte libre (`RegistrationSteps.tsx:279`, `InfoTab.tsx:151`, `AdminEstablishmentEditForm.tsx:506`, `manager-utils.ts:49,89`). Affichage brut d'un objet comme enfant React dans `web/src/app/forces-etatiques/[slug]/page.tsx:157` et `AdminEstablishmentDetail.tsx:533` (et `RegistrationSteps.tsx:497`) | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/forces-etatiques/commissariat-test-38367` → **500**. `/admin/etablissements/state_force/34` → « Une erreur est survenue » ; témoin : la force 33, sans horaires, s'affiche | **CONFIRMÉ (rejoué)** pour la page publique (500) et le détail admin (plantage, témoin OK). 422 confirmé par le code et par 2 testeurs indépendants. **Aggravant :** la force du seed `commissariat-en-cours-de-validation` (en attente, avec horaires) ne peut pas être ouverte par l'admin pour être validée, même sur une base fraîche | Choisir un seul contrat. Recommandé : garder le JSON structuré, ajouter un éditeur d'horaires (jours + plages) et un formateur `formatOpeningHours()` pour tous les affichages et le JSON-LD. Sinon, accepter du texte côté API |
| R03 | BLOQUANT | Prestataire | La page de gestion d'une force étatique (`/espace-prestataire/state_force/{slug}`) plante toujours : aucun onglet n'est utilisable (infos, médias, justificatifs, demandes sensibles) | `toDraft()` appelle `est.executives.map(...)` sans garde (`web/src/components/establishment/manager-utils.ts:51`). Or `MyEstablishmentResource` ne renvoie pas `executives` pour une force (`backend/app/Http/Resources/Establishments/MyEstablishmentResource.php:96-106`). Défaut présent dès le code commité | Connexion `ep-owner@` → `/espace-prestataire` → « Gérer » sur *Commissariat Test 38367* | **CONFIRMÉ (rejoué)** avec `11-sf-page.js` : `TypeError: Cannot read properties of undefined (reading 'map') at toDraft` | `executives: (est.executives ?? []).map(…)` et/ou `'executives' => []` dans la branche force de la ressource, plus un test Vitest sur `toDraft` pour une force |
| R04 | BLOQUANT (régression non commitée) | Back-office (blog, pages) | L'éditeur riche affiche les balises brutes du contenu existant. À la première frappe puis à l'enregistrement, le corps est sauvegardé **échappé** (`&lt;h2&gt;…`) : la mise en forme est détruite et les balises apparaissent en texte sur le site (BO-04) | `web/src/components/admin/content/RichTextEditor.tsx:45` : `ref.current.textContent = sanitizeEditorHtml(...)`. **`git diff` montre que la version commitée utilisait `innerHTML`** : régression introduite dans l'arbre de travail | Créer un brouillon avec `body="<h2>Titre</h2><p>…</p>"`, l'ouvrir dans `/admin/blog/{id}`, taper un mot, enregistrer, relire le corps | **CONFIRMÉ (code + diff)**, avec la preuve du testeur (corps échappé relu par l'API, capture `back-office-editeur-riche-balises.jpg`) | Revenir à `innerHTML` (le contenu est déjà nettoyé par `sanitizeEditorHtml`) et ajouter un test « contenu initial HTML rendu » |
| R05 | BLOQUANT (fonctionnalité inachevée) | Back-office | **Import Excel** : le front appelle `/api/v1/admin/establishment-imports*` (liste, upload, lignes, confirmation, modèle, rapport), mais **aucune route ni contrôleur** n'existe (BO-01). `/admin/etablissements` produit aussi 2 erreurs 404 à chaque ouverture (filtre « Lot d'import »). Le lecteur Excel appelle une méthode inexistante (S2) | Routes absentes de `backend/routes/api/admin.php` ; pas de `EstablishmentImportController`. `web/src/lib/api/imports.ts:84`. `backend/app/Services/Imports/ImportSpreadsheetReader.php:82` : `$cell->getColumnIndex()` n'existe pas dans PhpSpreadsheet 5.10 (seul `getColumn()` existe, Cell.php:130). Le module entier est **non suivi** par git, et `plan_import_etablissements.md` porte le statut « proposition à valider » | `GET /api/v1/admin/establishment-imports?page=1` (admin 2FA) → 404 | **CONFIRMÉ (rejoué)** : 404, `route:list` sans route d'import, `getColumnIndex` absent du vendor, Larastan le signale | Soit terminer le lot (contrôleur, routes, `Coordinate::columnIndexFromString($cell->getColumn())`, tests), soit **masquer l'entrée de menu et le filtre** tant que l'API n'existe pas |

### 2.2 Majeurs

| id | Gravité | Espace | Titre | Cause racine (fichier:ligne) | Reproduction courte | Verdict du chef | Correctif suggéré |
|---|---|---|---|---|---|---|---|
| R06 | MAJEUR | API | Un ID numérique > PHP_INT_MAX donne une **erreur 500** sur environ 25 routes `{id}` (SEC-B1, EC-B1) | `whereNumber` laisse passer 20 chiffres, puis la signature `int $id` du contrôleur lève une `TypeError` (ex. `app/Http/Controllers/Feedback/MyFeedbackController.php:38`, `Reviews/ReviewController.php:70`, `Admin/ReviewController.php:52`) | User : `GET /api/v1/me/feedbacks/99999999999999999999` → 500. Admin : `GET /admin/users/9223372036854775808` → 500. Avec 18 chiffres → 404 | **CONFIRMÉ (rejoué)**. Aucune fuite (message générique + `request_id`), mais cela viole security.md §1/§14/§20 et déclenche les alertes 5xx | `Route::pattern('id', '[0-9]{1,18}')` global (ou `->where('id','[0-9]{1,18}')`) à la place de `whereNumber` |
| R07 | MAJEUR (bloquant pour la mise en production) | Web | `next` 16.4.0 vulnérable : GHSA-2464-fhr4-w9xw (critique, RCE via l'optimiseur d'images + SVG), GHSA-673q-mjm6-r5xr (critique, `use cache`, non utilisé), GHSA-p3m5-59mp-jv5r (DoS Server Actions). Vu par 3 testeurs (SEC-B2, FO-B13, observation EC) | `web/package.json` `"next": "^16.4.0"` | `cd web && npm audit --omit=dev` | **CONFIRMÉ (rejoué)** : 1 critique + 1 élevée (zod). Atténuants : `sharp` 0.35.5 installé, image Docker Alpine (musl) | `npm install next@^16.4.6` (voir §3) |
| R08 | MAJEUR | API | Symfony 8.1.6-8.1.8 vulnérable (mime, routing, http-foundation ×4, http-kernel, filesystem) + phpunit 13.4.1 (dev) (SEC-B3) | `backend/composer.lock` | `cd backend && composer audit` | **CONFIRMÉ (rejoué)** | `composer update "symfony/*" phpunit/phpunit` (≥ 8.1.11 / ≥ 13.4.4) |
| R09 | MAJEUR | Back-office | Un éditeur sans 2FA entre dans la coquille admin, puis chaque liste affiche « Accès refusé… activer la double authentification », **sans lien vers /compte**. C'est le cas du compte du seed `editeur@demo` (BO-02) | `web/src/components/admin/AdminAccessGate.tsx:54` ne teste la 2FA que pour `role === 'admin'` (commentaire l.16 faux). L'API l'exige pour tout le personnel (`EnsureTwoFactorForStaff` + `User::isStaff()` = admin + editor) | Connexion `editeur@demo.protectici.test` → `/admin/blog` | **CONFIRMÉ (rejoué API + code)** : `GET /content/posts` → 403 « Veuillez activer la double authentification… » | Condition `(user.role === 'admin' \|\| user.role === 'editor') && !user.two_factor_enabled` |
| R10 | MAJEUR (mobile first) | Prestataire (et tout `<Table>` avec en-tête `sr-only`) | Défilement horizontal à 375 px sur `/espace-prestataire/devis` (EP-B5) | `web/src/components/ui/Table.tsx:20` : le conteneur `.ui-table` (`overflow:auto`) n'est pas positionné, donc le `span.sr-only` (absolu) déborde du document | 375×812, `prestataire@demo` → `/espace-prestataire/devis` | **CONFIRMÉ (rejoué)** : `scrollWidth` 829 pour 375 de large (3 lignes) ; `/espace-prestataire/avis` et `/compte/mes-devis` sans débordement | Ajouter `relative` à la classe du conteneur |
| R11 | MAJEUR | Front-office / API blog | Compteur de vues des articles faussé : la vue est comptée côté API avec l'IP de la requête, or la requête vient du rendu serveur Next (même IP pour tous), dédoublonnée 30 min. Les fiches prestataires, elles, comptent bien via un POST navigateur (FO-B3) | `backend/app/Http/Controllers/Blog/BlogController.php:45` + `Services/Content/BlogQueries.php:68-78`. `web/src/lib/api/server.ts` ne transmet pas l'IP cliente | 3 visiteurs distincts → +1 vue (188 → 189) | **CONFIRMÉ (code)** : aucune transmission d'IP dans `server.ts`, comptage dans `show()` | Comme pour les prestataires : `POST /blog/posts/{slug}/view` depuis le navigateur, et `show()` sans effet de bord |
| R12 | MAJEUR (CI rouge) | Suites | `web/tests/wave-b-client.test.ts` corrompu (l.22 et 26) : `ReferenceError` au chargement, 15 erreurs TS, 1 avertissement ESLint (S1) | Modification **non commitée** de 2 lignes (`git diff`) | `cd web && npx vitest run tests/wave-b-client.test.ts` | **CONFIRMÉ (rejoué)** : « 1 failed, no tests ». La version commitée passe 7/7 (contre-épreuve du testeur) | `git checkout web/tests/wave-b-client.test.ts` |

### 2.3 Mineurs

Pour les mineurs : vérification par lecture de code ou contrôle rapide.

| id | Espace | Titre | Cause / fichier | Verdict | Correctif suggéré |
|---|---|---|---|---|---|
| R13 | API / prestataire | Upload au-delà de `upload_max_filesize` : message brut `validation.uploaded` (SEC-B5, EP-B8) | Clé `uploaded` absente de `backend/lang/fr/validation.php` (la limite locale de 2 Mo relève de l'environnement, voir §4) | CONFIRMÉ (code) | Ajouter `'uploaded' => 'Le fichier :attribute n\'a pas pu être envoyé (taille maximale dépassée).'` |
| R14 | Transversal | Deux erreurs console `401 /auth/user` par page en visiteur (FO-B7, EC-B9) | `SessionProvider.tsx:51` : effet doublé par `reactStrictMode` en dev ; le 401 « anonyme » est traité comme une erreur | CONFIRMÉ (code). En production, une seule erreur attendue (non vérifié en build) | Endpoint qui renvoie `200 {data:null}` en anonyme, ou cookie indicateur avant l'appel |
| R15 | Données du seed | Élisions manquantes (« de Abobo », « de Adjamé », « de Anyama »…), jusque dans les slugs (`commissariat-de-police-de-adjame`) (EP-B12, FO-B5) | `backend/database/seeders/DemoSeeder.php:269,442,444,448,451` (`'de '.$nom`) | CONFIRMÉ (lecture de la base) | Helper `deCommune()` (« d'Abobo »). Viole CLAUDE.md §5.1-6 |
| R16 | Espace client | « …et, bientôt, de publier des avis » sur `/inscription` (EC-B6, FO-B9) | `web/src/app/inscription/page.tsx:15` | CONFIRMÉ (code) | Retirer « bientôt » |
| R17 | Prestataire | Rafale de 403 (5 appels, 10 en dev) sur `/espace-prestataire/devis` pour un user sans fiche (EP-B6) | `QuotesReceived.tsx:35-38` : compteurs lancés sans attendre la liste | NON VÉRIFIÉ (preuve réseau du testeur) | Ne lancer les compteurs qu'après un premier 200 |
| R18 | Back-office | La cloche appelle `GET /admin/notifications` pour l'éditeur → 403 sur chaque page (BO-05) | `AdminShell.tsx:249` rend `NotificationBell` sans condition de rôle | CONFIRMÉ (code) | `{user.role === 'admin' && <NotificationBell/>}` |
| R19 | Back-office (a11y) | Même nom accessible pour le filtre de liste et le sélecteur du détail (« Statut du dossier ») (BO-06) | `FeedbackDetail.tsx:116`, `QuoteDetail.tsx:113` | NON VÉRIFIÉ | Renommer « Changer le statut du dossier » |
| R20 | Back-office | Un anonyme sur `/admin/avis` est redirigé avec `redirect=/admin` : la page demandée est perdue (BO-07) | `AdminAccessGate.tsx:24` (`'/admin'` en dur) | CONFIRMÉ (code) | `redirect: pathname` |
| R21 | Back-office | La touche Échap ne ferme pas le menu mobile de l'admin (BO-09, « à confirmer ») | `AdminShell.tsx:143-169` : aucun gestionnaire `keydown`/Escape | CONFIRMÉ (code) | Écouteur Escape + retour du focus sur le bouton burger |
| R22 | Web | `zod` 4.6.5 vulnérable (GHSA-mrhx-c7xc-m3w5) (SEC-B4) | `web/package.json` | CONFIRMÉ (`npm audit`) | `zod@^4.6.6` |
| R23 | API | Le HTML est retiré silencieusement au lieu d'être rejeté (`Kouassi<script>` est stocké « Kouassialert(...) ») (SEC-B6) | `backend/app/Support/PlainText.php:39` (`strip_tags`) ; security.md §1 demande de rejeter | CONFIRMÉ (code) | Règle de validation « sans balises » (422) sur les champs texte publics, ou mise à jour de security.md |
| R24 | API | `PATCH /auth/profile` avec un JSON malformé → 200 (corps traité comme vide) au lieu de 400 (SEC-B7) | Comportement par défaut de Laravel | NON VÉRIFIÉ | Middleware qui rejette un `Content-Type: application/json` non décodable |
| R25 | API | Une réponse publique `Cache-Control: public, max-age=60` porte aussi `Set-Cookie` (XSRF + session) quand l'origine est stateful (SEC-B9) | `CachePublicResponse` + middleware de session Sanctum | CONFIRMÉ (rejoué, `curl` sur `/providers/aigle-securite`) ; `Vary: Cookie` atténue le risque | Retirer `Set-Cookie` des réponses `public`, ou passer en `private` dès qu'un cookie est émis |
| R26 | API | `POST /me/quote-requests/{id}/reply` et `POST /reviews/{id}/report` valident le corps avant l'autorisation (422 au lieu de 403/404) (EC-B2) | `ProviderQuoteController.php:58-61` (le FormRequest `authorize()` renvoie true) | CONFIRMÉ (code) | Autoriser dans `ReplyQuoteRequest::authorize()` |
| R27 | Espace client | Le formulaire de revendication (EC-B3) et celui d'avis (EC-B8) sont réaffichés alors qu'une demande ou un avis existe déjà : le 409 n'arrive qu'après saisie | `ClaimForm` ne lit pas `/me/claims` ; `ReviewForm.tsx` ne lit pas `/me/reviews` | NON VÉRIFIÉ (sorties de script du testeur) | Interroger l'état existant et afficher « demande en cours » ou « votre avis » |
| R28 | Espace client | `/devis` et `/dis-moi-tout` ne préremplissent pas les coordonnées d'un utilisateur connecté (EC-B4) | `QuoteForm.tsx:48`, `FeedbackForm.tsx:72` (`useSession` sert seulement à `signedIn`) | CONFIRMÉ (code) | Initialiser nom, prénom, e-mail et téléphone depuis la session |
| R29 | Espace client | Lien de vérification déjà utilisé → « … créez à nouveau votre compte » (trompeur) (EC-B5) | `app/Services/Auth/EmailVerification.php:33` | NON VÉRIFIÉ | Message « lien déjà utilisé ; si votre adresse est confirmée, connectez-vous » |
| R30 | Espace client | Compte non vérifié à la connexion : deux messages redondants (EC-B7) | Page de connexion | NON VÉRIFIÉ (capture du testeur) | Un seul message |
| R31 | Espace client | Aucun bouton « Retirer » dans « Mes favoris » (EC-B11) | `components/account/FavoritesSection.tsx` (aucune action) | CONFIRMÉ (code) | Bouton qui appelle `DELETE providers/{p}/favorite` |
| R32 | Espace client | Visiteur : redirection pour `/compte` et `/compte/mes-avis`, encart pour `mes-devis` et `mes-dis-moi-tout` ; un connecté voit encore le formulaire de `/connexion` (EC-B12) | Gardes hétérogènes | NON VÉRIFIÉ | Une seule garde `RequireAuth` |
| R33 | Prestataire | Pas de « Signaler » dans `/espace-prestataire/avis` (EP-B11) | `ReportReviewButton` utilisé seulement dans `ReviewsList.tsx` | CONFIRMÉ (code) | Réutiliser le bouton |
| R34 | Prestataire (a11y) | Le lien « ← Mes établissements » mesure 16 px de haut (< 24 px, WCAG 2.5.8) (EP-B9) | `app/espace-prestataire/[type]/[slug]/page.tsx:30` | NON VÉRIFIÉ | `min-h-tap` |
| R35 | Front-office | « 43 établissements vérifiés » sur l'accueil, alors que 13 seulement portent le badge « vérifié » (FO-B4) | `web/src/app/page.tsx:130` ; `HomeController.php:20` compte toutes les fiches publiées | CONFIRMÉ (code) | « 43 établissements référencés » |
| R36 | Front-office | Si l'API renvoie une erreur autre que 404 (ex. 429), une page article ou institutionnelle s'affiche en **HTTP 200** sans h1, donc indexable (FO-B6) | `web/src/app/blog/[slug]/page.tsx:25,53-58` ; aggravé en local par l'absence de `SSR_SHARED_SECRET` | NON VÉRIFIÉ (relevé du crawl) | Lever une erreur (statut 5xx) au lieu de rendre un état vide en 200 |
| R37 | Front-office | Le bandeau cookies (`z-50`) recouvre les options des listes déroulantes ouvertes vers le bas (FO-B8) | Bandeau fixe en bas de l'écran | NON VÉRIFIÉ | z-index des listes au-dessus du bandeau, ou ouverture vers le haut |
| R38 | Front-office (avant prod) | Tuiles chargées depuis `tile.openstreetmap.org` (FO-B12) | Configuration de la carte ; CLAUDE.md §3.1 | CONFIRMÉ (testeur) ; c'est un choix de fournisseur [À DÉFINIR] | Variable d'environnement d'URL de tuiles (MapTiler ou Stadia) |
| R39 | Suites | Larastan : `ImportColumns.php:87` sans type itérable (S3). Pint : 3 fichiers non suivis (S4) | Module d'import non suivi | CONFIRMÉ (rejoué Larastan) | `vendor/bin/pint` + PHPDoc |

### 2.4 Cosmétiques

| id | Espace | Titre | Fichier | Verdict |
|---|---|---|---|---|
| R40 | Back-office | Journal : « Objet : n° » vide pour les événements sans objet (BO-08) | `components/admin/audit/AdminAuditView.tsx:258-261` | CONFIRMÉ (code) |
| R41 | Prestataire | Forme juridique affichée en code brut (« sarl ») dans « Modifications sensibles » (EP-B10) | `manager-utils.ts:109-116` (`displayFieldValue` ne gère pas `legal_form`) | CONFIRMÉ (code) |
| R42 | Front-office | Badge « OUVERT 24 H/24 » et « Horaires non communiqués » affichés ensemble (FO-B10) | `forces-etatiques/[slug]/page.tsx:92,157` (à traiter avec R02) | CONFIRMÉ (code) |
| R43 | Front-office | « Position utilisée » affiché deux fois (FO-B11) | Bloc « forces les plus proches » | NON VÉRIFIÉ |
| R44 | Espace client | « Signaler cet avis » proposé sur son propre avis (l'API refuse en 403) ; boutons sans nom accessible distinctif (EC-B10) | `ReviewsList.tsx` | NON VÉRIFIÉ |

**Faux positifs et non-bugs écartés :**
- CORS bloquant `:3003` (EP, BO) : variable d'environnement, voir §4.
- `/espace-prestataire` accessible à un user : conforme à `docs/api-contract.md` §7.2.
- `password123` accepté : `uncompromised()` est volontairement désactivé hors production et staging.
- Absence de `/newsletter` : aucun lien n'y mène.
- Un dossier peut repasser de « clôturé » à « nouveau » : choix de workflow à trancher, pas un bug.
- Les anciens constats `abort(403)` (ChangeRequests, PostController, ReviewModeration) et `branches` obligatoire : **DÉJÀ CORRIGÉS**.

---

## 3. Dépendances et sécurité

| Paquet | Version actuelle | Cible | Gravité | Commande |
|---|---|---|---|---|
| `next` (web) | 16.4.0 | **≥ 16.4.1** (recommandé 16.4.6) | Critique (RCE via `/_next/image` + SVG si Linux glibc et `sharp` < 0.35.5 ; RCE `use cache` ; DoS Server Actions) | `npm install next@^16.4.6` puis vérifier `sharp ≥ 0.35.5` dans `package-lock.json` (aujourd'hui `^0.35.4` déclaré, 0.35.5 installé) |
| `zod` (web) | 4.6.5 | 4.6.6 | Élevée (épuisement mémoire) | `npm install zod@^4.6.6` |
| `symfony/mime` | 8.1.7 | 8.1.10+ | Moyenne (injection d'en-tête e-mail, CVE-2026-45070) | `composer update "symfony/*"` |
| `symfony/routing`, `http-foundation`, `http-kernel`, `filesystem` | 8.1.6–8.1.8 | 8.1.11 | Contournements de règles de chemin, en-têtes forwarded, proxys de confiance, évasion de chemin | idem |
| `phpunit/phpunit` (dev) | 13.4.1 | 13.4.4 | Moyenne (CVE-2026-119193) | `composer update phpunit/phpunit` |

Points de sécurité **vérifiés comme conformes** :
- autorisations et matrice de rôles ;
- 2FA du personnel (côté API) ;
- CSRF (419), CORS non réfléchi ;
- IDOR (403/404) ;
- mass assignment ignoré ;
- XSS neutralisée (serveur + rendu) ;
- uploads (type réel, réencodage WebP, nom ULID, disque privé signé) ;
- anti-énumération ;
- throttling de la connexion et de la newsletter ;
- en-têtes HTTP et CSP avec nonce ;
- cookies httpOnly, sans jeton dans le stockage navigateur ;
- invalidation des sessions (déconnexion, mot de passe) ;
- **expiration admin après 30 min d'inactivité** (testée par le chef : session vieillie de 31 min → 401).

À durcir avant la production :
- en-tête `nosniff` et interdiction de l'exécution PHP sous `/storage` dans `backend/docker/Caddyfile` ;
- vérifier le plafond par IP de `POST /auth/verification/resend` (security.md §18 : 10/h/IP ; seul le 3/h/adresse est visible dans le code) ;
- favoris sans `EnsureVerifiedEmail` (non exploitable aujourd'hui).

---

## 4. Problèmes d'environnement local et de documentation

### 4.1 Environnement local (pas des bugs produit)

| Problème | Effet observé | Action |
|---|---|---|
| `backend/.env` : `APP_URL=http://127.0.0.1:8001`, `FRONTEND_URL=…:3001`, `CORS_ALLOWED_ORIGINS` et `SANCTUM_STATEFUL_DOMAINS` sans `:3003` | Au début de la campagne, CORS bloquait le front `:3003` (contournement `--disable-web-security`). Le worker lancé sans variables générait des liens vers **8001, le port d'un autre projet (Itech)** | Aligner `.env` sur les ports réellement utilisés, ou toujours lancer API et worker avec les mêmes variables |
| Aucun worker de file | Aucun e-mail envoyé sans `queue:work` manuel | Ajouter le worker au `docker-compose` de dev, ou documenter la commande |
| PHP local `upload_max_filesize=2M` | Images de 2 à 5 Mo refusées (le Dockerfile de production met 10 Mo) | `php.ini` local à 10M/12M |
| Comptes du seed `admin@` et `editeur@` sans 2FA | API admin et contenu en 403 ; testeurs obligés de créer des comptes jetables | Seeder un secret TOTP de démonstration documenté, ou documenter la procédure (voir les rapports SEC et BO) |
| Limites par IP partagées (inscription 5/h, établissement 3/jour) | Plusieurs testeurs bloqués en 429 sur 127.0.0.1 | Normal ; pour les campagnes, `php artisan cache:clear` ou des limites configurables en local |
| `SSR_SHARED_SECRET` absent (`backend/.env` et `web/.env.local`) | Tout le rendu serveur partage le plafond public de 60 requêtes/min, ce qui provoque des pages d'erreur en crawl | Définir le secret en local comme en production |
| `reactStrictMode` (dev) | Appels doublés (401, 403) dans la console | Normal en dev ; à revérifier sur un build de production |

### 4.2 Écarts de documentation

| Document | Écart |
|---|---|
| `CLAUDE.md` §6.2 | Ports 8001 et 3000 recommandés, alors que 8001 est utilisé par un autre projet local et que la campagne tourne sur 8002 et 3003. Le paragraphe « localhost:3000 ↔ localhost:8000 » contredit la consigne « 127.0.0.1, jamais localhost ». La commande `queue:work` n'est pas mentionnée |
| `security.md` §19 | « micro désactivé par défaut », alors que `Permissions-Policy: microphone=(self)` est justifié par le message vocal (SEC-B8) : mettre la doc à jour |
| `security.md` §1 | « rejeter plutôt que nettoyer », alors que le code nettoie (`strip_tags`) : trancher (R23) |
| `docs/api-contract.md` / `web/src/lib/api/types.ts` / `modele.md` | `opening_hours` sans format dans le contrat, `string` côté TypeScript, `jsonb` structuré dans le modèle (cause de R02) |
| `plan_import_etablissements.md` | Statut « proposition à valider », alors que le front est livré dans l'arbre de travail sans l'API (R05) |
| Seed et documentation des comptes | Pas d'indication que le personnel du seed doit activer la 2FA avant d'accéder à l'admin |

---

## 5. Couverture

### 5.1 Testé (synthèse)

- **Public** :
  - crawl de 160 URL en ordinateur et 40 en 375 px ;
  - annuaire : filtres, pagination jusqu'à la page 4, `page=999`, proximité, géocodage, carte ;
  - fiches, forces étatiques, blog, pages institutionnelles, sitemap, robots ;
  - formulaires réellement soumis : contact, devis, newsletter (confirmation et désinscription), Dis-moi tout (texte et vocal), suivi, inscription d'établissement, revendication ;
  - navigation clavier et focus.
- **Compte** :
  - inscription, vérification, renvoi ;
  - connexion, « rester connecté », redirections sûres ;
  - réinitialisation (y compris lien expiré), changement de mot de passe ;
  - 2FA complète, y compris codes de secours ;
  - avis : CRUD, 409, modération, signalement ;
  - favoris, mes devis, mes Dis-moi tout, IDOR.
- **Prestataire** :
  - fiche par l'API (champs, validation, agences, médias, justificatifs) ;
  - demandes sensibles, cycle de validation ;
  - devis de bout en bout avec e-mails ;
  - isolation entre prestataires.
- **Back-office** : toutes les sections, sauf l'import (thème, responsive, 2FA, rôles).
- **API** : matrice des 151 routes, CSRF, CORS, injections, uploads, XSS (avec rendu Playwright), throttling de la connexion et de la newsletter, en-têtes, audits de dépendances.
- **Ajouts du chef d'équipe** (`.../scratchpad/chef/verify.py`, `age.php`, `after.py`, `ovf.js`, `adm-force.js`) :
  - **suppression de fiche** : nom erroné → 422, nom exact → 204, puis 404 côté admin et côté public (*soft delete* ; « rétablir » répond 404, la suppression n'est pas annulable depuis l'API) ;
  - **téléchargement de justificatif d'établissement** : 200 `application/pdf` en `attachment` ;
  - **pagination admin au-delà de la page 1** (utilisateurs p.2, avis p.2, établissements p.3, journal p.5) : OK ;
  - **expiration de session staff** : OK ;
  - détail admin d'une force avec horaires : **plantage**, intégré à R02.
- Le **throttling des formulaires contact, devis, Dis-moi tout et inscription jusqu'au 429** est couvert par Pest : `ContactTest`, `QuoteRequestStoreTest`, `FeedbackTest`, `RegistrationTest`. En live, seule la newsletter a été testée : les limites ne comptent que les créations réelles, donc pousser jusqu'au 429 aurait créé des données.

### 5.2 Non testé (à planifier)

| Zone | Raison | Priorité |
|---|---|---|
| Import Excel de bout en bout | Pas d'API (R05) | Haute, après développement |
| Onglets de gestion d'une force par l'UI (infos, médias, justificatifs, demandes) | Bloqué par R03 | Haute, après correctif |
| Réponse à un avis et réponse Dis-moi tout par l'UI, après correctif | Bloqué par R01 | Haute |
| Upload réel de 2 à 5 Mo | Limite PHP locale | Moyenne (staging) |
| Commandes de rétention et de purge (`Retention/PurgeEstablishmentFiles`, modifiée dans l'arbre de travail) | Personne ne les a lancées (base partagée) | Moyenne |
| Build de production (`npm run build`), cookies `Secure`/`__Host-`, HSTS effectif, Turnstile réel, `uncompromised()` | Interdits ou impossibles en local (pas de HTTPS) | Haute, en staging |
| Délivrabilité Resend (SPF/DKIM), audiences newsletter | E-mails en `log` | Moyenne (staging) |
| Géocodage Nominatim et pointage sur la carte dans l'espace prestataire, dirigeants par l'UI | Dépendance externe / temps | Basse |
| Lecteurs d'écran réels, audit de contraste complet, performances (Lighthouse sur réseau mobile) | Hors outillage de la campagne | Moyenne |
| Dis-moi tout vocal pour un utilisateur connecté, écoute complète du vocal en admin | Temps | Basse |
| Pagination du front admin (boutons) au-delà de la page 1 | Seule l'API a été vérifiée par le chef | Basse |

---

## 6. Évaluation des testeurs

| Testeur | Appréciation |
|---|---|
| **suites** | Rigoureux et utile : contre-épreuve avec la version commitée, origine de chaque échec dans l'arbre de travail, vérification `method_exists` pour S2. Un rapport court mais exact. |
| **securite-api** | Le plus exhaustif : matrice de routes automatisée, preuves HTTP précises, gravités justes et références à security.md. Les observations « sans bug » sont pertinentes. Aucune erreur relevée. |
| **back-office** | Très bonne couverture fonctionnelle et prudence sur les comptes partagés (2FA par l'UI sur des comptes jetables). Bons diagnostics (BO-03, BO-04 avec le code). BO-01 classé BLOQUANT sans préciser qu'il s'agit d'un module non commité et inachevé. |
| **espace-prestataire** | Excellent : causes racines exactes (fichier:ligne) et correctifs pertinents. Il a même signalé que `FeedbackDetail` avait la même structure fautive. A travaillé un temps avec `--disable-web-security` à cause de l'environnement, ce qu'il a correctement documenté. |
| **front-office** | Crawl systématique, vérifications croisées UI/API/base. Bonne trouvaille sur le compteur de vues (R11). Il a su distinguer les artefacts du 429. R35 (« vérifiés ») est plus une question de libellé qu'un bug. |
| **espace-client** | Méthodique, avec une re-vérification explicite des anciens constats. A bien nuancé B9 (StrictMode). Plusieurs mineurs restent peu documentés (preuves = sorties de script), d'où mon verdict « non vérifié » pour ceux-là. |

---

## 7. Ordre de correction recommandé

1. **Lot 0 — Hygiène de l'arbre de travail (½ j)**
   - Revenir sur `RichTextEditor.tsx` (R04) et `wave-b-client.test.ts` (R12).
   - Décider du sort du module d'import (R05) : branche dédiée, ou masquer le menu et le filtre.
   - Commiter le reste par lots cohérents (revendications, agences, mes devis, mes Dis-moi tout, mails).
2. **Lot 1 — Bloquants fonctionnels (1-2 j)**
   - R01 : sortir les 2 `ConfirmDialog` des formulaires, plus un test d'intégration « clic de confirmation → POST ».
   - R03 : garde `executives` et test `toDraft` pour une force.
   - R02 : contrat des horaires (éditeur structuré + formateur partagé pour la page publique, l'admin, le récapitulatif d'inscription et le JSON-LD), plus des tests de rendu d'une force avec horaires.
3. **Lot 2 — Sécurité et dépendances (½ j)**
   - R07, R08, R22 : montées de version, puis Pest, Vitest et build.
   - R06 : motif `id` sur 1 à 18 chiffres, plus un test.
   - R25 et R26.
4. **Lot 3 — Majeurs restants (1 j)**
   - R09 : garde 2FA de l'éditeur ;
   - R10 : `relative` sur `.ui-table`, plus une vérification à 375 px de tous les tableaux ;
   - R11 : vue du blog côté navigateur ;
   - R13 : traduction `uploaded`.
5. **Lot 4 — Ergonomie et accessibilité (1-2 j)** : R14, R17-R21, R27-R34, R36, R37, puis les cosmétiques R40-R44.
6. **Lot 5 — Données et documentation (½ j)**
   - R15 (élisions du seed), R16, R35 ;
   - mises à jour de CLAUDE.md §6.2, security.md §1/§19 et du contrat `opening_hours` ;
   - comptes du seed et 2FA ;
   - fournisseur de tuiles (R38) avant la production.
7. **Lot 6 — Seconde campagne ciblée** : les trous de couverture du §5.2, en priorité sur le staging (build de production, HTTPS, Turnstile, Resend, uploads de 2 à 5 Mo).

---

## 8. Données de test laissées en base (`protectici_dev`)

**Comptes** (tous en `@demo.protectici.test`, sauf l'anonymisé) :

| Testeur | Comptes |
|---|---|
| Back-office | `bo-admin` (admin, 2FA), `bo-editeur` (editor, 2FA), `bo-user` (devenu provider par revendication), `bo-provider`, `bo-jetable` → anonymisé (`anonymise-42@anonymise.invalid`, inactif) |
| Espace prestataire | `ep-admin` (admin, 2FA), `ep-owner` (provider), `ep-user` |
| Front-office | `fo-etab-30950` (vérifié en base) |
| Sécurité/API | `secu-admin` (2FA), `secu-editor` (2FA), `secu-user`, `secu-user2`, `secu-jetable`, `secu-reg1` (non vérifié) ; abonnés newsletter `secu-nl0..4`, `nl-fo702013` (désinscrit) |
| Espace client | `jetable-ec1`, `jetable-ec2`, `jetable-ec3`, `ec-admin` (admin, 2FA). Mots de passe propres à ces comptes : voir le rapport espace-client |

Les secrets TOTP sont dans le scratchpad (`securite-api/secrets.json`, `back-office/secrets.json`, `espace-prestataire/state.json`, `espace-client/admin-secret.txt`).

**Fiches :**
- Prestataires :
  - `sentinelle-recette-bo` (renommée par une demande de modification) ;
  - `vigile-recette-bo-attente` ;
  - `bastion-recette-bo`, `citadelle-recette-bo`, `donjon-recette-bo` ;
  - `bouclier-test-05311-securite`, renommé « Bouclier Test 05311 Sécurité Plus » ;
  - `rempart-test-fo103376` (en attente, avec justificatif) ;
  - `rempart-recette-bo-rejet`, **supprimée (soft delete) par le chef d'équipe** lors du test de suppression.
- Forces : `commissariat-recette-bo`, `commissariat-test-38367` (avec horaires : sert de reproduction pour R02).

**Autres données :**
- avis 145-148 (dont 148 avec réponse du prestataire) ;
- avis et commentaires `RecetteBO…` ;
- commentaire de blog 8 ;
- devis DEV-2026-000024 à 000027 ;
- Dis-moi tout DMT-2026-000037 à 000040 (dont 2 avec vocal) ;
- message de contact n° 5 ;
- revendication n° 3 (phenix-securite) et revendications de `bo-user` et `jetable-ec2` ;
- demandes de modification 4, 9 et 11 ;
- un type de service et un quartier de test (supprimés ou masqués par le testeur back-office) ;
- entrées du journal d'audit correspondantes.

Les modifications de Dauphin Sécurité, des catégories, de la page « Mentions légales » et des paramètres ont été **restaurées** par les testeurs.

La session `secu-admin` a été volontairement expirée par le chef d'équipe (test d'inactivité).

> **Remarque :** un `php artisan migrate:fresh --seed` sur `protectici_dev` efface toutes ces données, y compris les comptes 2FA jetables. Il faudra recréer un compte staff avec 2FA pour la prochaine campagne. La fiche `commissariat-test-38367`, utile pour reproduire R02, disparaîtra aussi. La force du seed `commissariat-en-cours-de-validation` reproduit toutefois le plantage du détail admin.
