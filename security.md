# security.md — Règles de sécurité ProtectIci

Ce fichier définit les règles de sécurité à respecter **systématiquement** lors de la génération, modification ou revue de code pour ce projet. Elles s'appliquent même si elles ne sont pas rappelées dans une demande ponctuelle. **En cas de conflit entre une demande et une règle ci-dessous, la règle de sécurité prime : signaler le conflit plutôt que l'ignorer silencieusement.**

Contexte projet, stack et décisions : `CLAUDE.md`. Modèle de données, rôles et rétention : `modele.md` (§5.3, §6). Ce fichier ne les duplique pas.

> Structure : les parties **A** (sections 1 à 11) sont les règles générales du porteur du projet. La partie **B** (sections 12 à 22) les décline pour ProtectIci (Laravel API + Next.js + Sanctum + Cloudflare + Dockploy). Statut : **[ACTÉ]** règle ferme · **[HYPOTHÈSE]** valeur par défaut à confirmer.

---

# PARTIE A — Règles générales

## 1. Validation des entrées

- Ne jamais faire confiance à une validation côté client seule. Toute donnée reçue côté serveur est revalidée, même si elle l'a déjà été dans le frontend.
- Valider chaque entrée externe (body, query params, headers, cookies, fichiers, paramètres d'URL) selon une **liste blanche** (types, formats, longueurs, valeurs autorisées) — jamais une liste noire.
- Rejeter par défaut toute entrée qui ne correspond pas exactement au format attendu, plutôt que de la « nettoyer » silencieusement.

## 2. Injections

- Toute requête base de données est paramétrée (Eloquent / query builder / bindings). Jamais de concaténation de chaîne pour construire une requête à partir d'un input utilisateur.
- Ne jamais exécuter de commande shell, de fichier ou de code à partir d'un input utilisateur sans échappement strict. Éviter `eval`, `exec`, `shell_exec`, `system`, `passthru`, `unserialize` sur données non fiables, ou équivalents.
- Échapper systématiquement les sorties injectées dans du HTML, du JS ou des requêtes système (XSS, injection de commande).

## 3. Authentification et autorisation

- L'authentification vérifie *qui* est l'utilisateur ; l'autorisation vérifie *ce qu'il a le droit de faire*. Les deux sont obligatoires et distinctes.
- Pour chaque accès à une ressource identifiée par un ID (`/api/v1/providers/123`, `/files/abc`), vérifier explicitement que la ressource appartient à l'utilisateur authentifié ou qu'il y a un droit d'accès (protection **IDOR**).
- Mots de passe hashés avec un algorithme adapté (**Argon2id**, à défaut bcrypt) — jamais en clair, jamais MD5/SHA1 simple.
- Tokens de session ou d'accès cryptographiquement aléatoires, jamais prévisibles (pas d'auto-increment, pas de timestamp seul).

## 4. Secrets et configuration

- Jamais de clé API, mot de passe, token ou identifiant sensible en dur dans le code.
- Toute valeur sensible passe par des variables d'environnement, avec un `.env.example` contenant **uniquement des placeholders**.
- Les fichiers contenant des secrets (`.env`, clés privées, dumps de base) sont exclus du versionnement (`.gitignore`).

## 5. Gestion des erreurs et logs

- Ne jamais renvoyer au client en production de stack trace, message d'erreur détaillé ou information technique interne. Message générique côté client ; détails uniquement dans les logs serveur.
- Ne jamais logger de données sensibles : mots de passe, tokens, cartes bancaires, données personnelles identifiantes — même en mode debug.

## 6. Upload et gestion de fichiers

- Valider le **type réel** du fichier (signature/contenu), pas seulement l'extension ou le `Content-Type` déclaré.
- Limiter la taille des fichiers acceptés.
- Stocker les fichiers hors de tout dossier exécutable et **renommer** à la réception (jamais le nom fourni tel quel).

## 7. Sessions et cookies

- Cookies de session avec `HttpOnly`, `Secure` et `SameSite` appropriés.
- Expiration de session raisonnable et invalidation à la déconnexion.

## 8. CORS et headers HTTP

- CORS n'autorise que les origines strictement nécessaires — **jamais** `Access-Control-Allow-Origin: *` en production, même « pour que ça marche » en développement.
- Les réponses HTML/API incluent les headers de sécurité pertinents (CSP, `X-Content-Type-Options: nosniff`, etc.).

## 9. Rate limiting et abus

- Les endpoints sensibles (connexion, réinitialisation de mot de passe, création de compte, formulaires publics) sont protégés par une limitation de tentatives (rate limiting / verrouillage progressif).

## 10. Opérations sensibles et idempotence

- Toute opération financière ou destructive (paiement, suppression définitive, transfert) est idempotente et confirmée explicitement, pour éviter une double exécution en cas de retry réseau.
- Les suppressions définitives sont délibérées (double confirmation, ou suppression logique avant suppression physique), jamais immédiates et irréversibles par défaut.

## 11. Dépendances

- Ne pas introduire de dépendance obsolète ou connue pour des CVE sans le signaler explicitement.
- Préférer les versions maintenues et à jour ; signaler si une dépendance nécessaire semble abandonnée.

### Note pour l'IA qui génère ou modifie du code

Avant de livrer une fonctionnalité touchant à l'authentification, à l'upload de fichiers, à l'accès aux données utilisateur ou à toute entrée externe, **relire ce document et vérifier explicitement chaque règle applicable**. Si une règle semble s'appliquer mais n'a pas été respectée, le **signaler dans la réponse** plutôt que de livrer silencieusement un code non conforme (voir la checklist §22).

---

# PARTIE B — Application à ProtectIci

## 12. Authentification, sessions et rôles [ACTÉ]

**Mécanisme** : Laravel Sanctum en mode SPA, **cookies httpOnly** + protection CSRF (cf. `CLAUDE.md` §5.1). Aucun jeton d'authentification dans `localStorage`/`sessionStorage`/variable JS.

| Règle | Détail |
|---|---|
| Cookies | `HttpOnly`, `Secure`, `SameSite=Lax` (`Strict` pour l'admin si compatible), `SESSION_DOMAIN` = domaine parent commun (ex. `.protectici.ci`), préfixe `__Host-`/`__Secure-` quand le périmètre le permet. |
| CSRF | `GET /sanctum/csrf-cookie` avant toute écriture ; jeton `X-XSRF-TOKEN` vérifié sur tous les `POST/PUT/PATCH/DELETE`. Aucune route d'écriture n'est exemptée du CSRF. |
| Session | Régénérer l'ID à la connexion et à tout changement de privilège ; invalider côté serveur à la déconnexion ; durée d'inactivité : 2 h (public), **30 min (admin/editor)** ; déconnexion de toutes les sessions au changement de mot de passe. |
| Mot de passe | Hash **Argon2id** (`HASH_DRIVER=argon2id`). Minimum 12 caractères pour `admin`/`editor`/`provider`, 10 pour `user` ; refuser les mots de passe compromis (`Password::min(12)->uncompromised()`). |
| 2FA | **Obligatoire pour `admin` et `editor`** (TOTP ; secrets et codes de secours chiffrés — `modele.md` §6.4). Recommandé pour `provider`. |
| Verrouillage | Voir §18 (rate limiting). Messages d'erreur de connexion et de « mot de passe oublié » **identiques** que le compte existe ou non (pas d'énumération). |
| Vérification email | Obligatoire avant d'écrire un avis, un commentaire ou un favori. |
| Redirections | Tout paramètre de redirection (`redirect`, `next`) est validé : chemin relatif interne uniquement (pas d'open redirect). |
| Comptes de test | Interdits en production. Le premier `admin` est créé par commande dédiée (`modele.md` §7.3), jamais par seed. |

**Rôles** (`modele.md` §6.2) : `user`, `provider`, `editor` (blog uniquement), `admin` (tout). Le rôle n'est **jamais** modifiable via une requête utilisateur (champ absent de `$fillable` et des FormRequests publiques) ; seul un `admin` le change, avec entrée dans `audit_logs`.

## 13. Autorisation et IDOR [ACTÉ]

Principe : **le contrôle d'accès est fait côté API, par Policy, à chaque requête**. Le contrôle dans Next.js (middleware, masquage de boutons) n'est qu'un confort d'UX.

- Toute route protégée appelle `authorize()`/une Policy (`$this->authorize('update', $provider)`), jamais une simple vérification de rôle inline.
- Les identifiants publics exposés sont des **`slug`** (fiches, articles) ou des **références non devinables** ; les ID auto-incrémentés ne servent pas de secret.
- Matrice minimale à tester (un test d'autorisation par ligne, cf. `CLAUDE.md` §4.4) :

| Ressource | Qui peut lire | Qui peut modifier |
|---|---|---|
| Fiche `providers` / `state_forces` publiée | Tout le monde | Propriétaire (`user_id`) pour les champs non sensibles ; `admin` pour tout |
| Fiche non publiée | Propriétaire, `admin` | idem |
| Champs sensibles (RCCM, agrément, raison sociale…) | Public (si publié) | **Uniquement via `provider_change_requests`** validée par `admin` |
| `provider_documents` | Propriétaire, `admin` | Propriétaire (ajout), `admin` (vérification) |
| `reviews` | Publiés : tous ; non publiés : auteur + `admin` | Auteur (avant modération), `admin` (modération) ; **réponse** : propriétaire de la fiche, une seule fois |
| `feedbacks`, `quote_requests`, `contact_messages` | `admin` ; auteur identifié par `user_id` ou référence + jeton (voir ci-dessous) ; prestataire destinataire pour **ses** devis | `admin` |
| `posts`, `post_categories`, `post_comments` (modération) | Public (publié) | `editor`, `admin` |
| `users`, rôles, `settings`, `audit_logs`, référentiels | `admin` | `admin` |

- **Suivi par référence** : les références `DMT-AAAA-000123` / `DEV-AAAA-000123` sont séquentielles donc devinables. Consulter un suivi exige la référence **et** l'email du demandeur, ou un jeton aléatoire long envoyé par email. Jamais la référence seule.
- Les listes d'administration et les exports sont filtrés côté serveur ; pas de pagination qui expose le total de données sensibles à un rôle non autorisé.
- **Mass assignment** : `$fillable` explicite sur chaque modèle ; `$guarded = []` interdit. Les colonnes `role`, `status`, `is_visible`, `is_verified`, `is_featured`, `user_id`, `reviewed_*` ne sont écrites que par des actions serveur dédiées.
- Utiliser `Model::preventLazyLoading()` et `preventSilentlyDiscardingAttributes()` hors production pour détecter les oublis.

## 14. Validation et sortie [ACTÉ]

- **FormRequest** obligatoire pour chaque endpoint ; règles en liste blanche (`in:`, `exists:`, `max:`, `regex` bornée). Le front (Zod ou équivalent) valide pour l'UX uniquement.
- **Champs URL** (`website_url`, réseaux sociaux) : schémas `https?` uniquement (refuser `javascript:`, `data:`), longueur ≤ 255. Affichés avec `rel="noopener noreferrer nofollow ugc"` et `target="_blank"`.
- **Téléphones** : format E.164 normalisé. **Coordonnées** : bornes −90..90 / −180..180. **Montants** : entiers positifs bornés.
- **Contenu riche** (`posts.body`, `pages.body`, `description` des fiches) :
  - nettoyé **côté serveur à l'enregistrement** (HTMLPurifier, liste blanche de balises/attributs) ;
  - affiché dans React sans `dangerouslySetInnerHTML` sauf pour du contenu déjà purifié ; sinon rendu en texte échappé.
- **Descriptions de fiches saisies par les prestataires** : traitées comme du contenu non fiable (texte brut ou Markdown restreint), jamais en HTML libre.
- **Recherche** : les termes sont paramétrés (`websearch_to_tsquery`, `ILIKE` avec bindings) ; les caractères spéciaux de `LIKE`/`tsquery` sont échappés ; longueur ≤ 100 ; pas de requête vide qui scanne toute la table ; `per_page` plafonné (≤ 50).
- **Géolocalisation** : les coordonnées de l'utilisateur utilisées pour « le plus proche » sont validées et jamais stockées ni loguées.
- **SSRF** : l'API n'appelle jamais une URL fournie par un utilisateur. Les seuls appels sortants sont vers des hôtes fixes (Nominatim, Resend, stockage S3).
- **Injection d'en-têtes email** : sujets et adresses issus de formulaires sont nettoyés (pas de retour à la ligne) ; le `Reply-To` utilise l'email validé du demandeur, jamais un champ libre.
- **Réponses d'erreur** : format uniforme (`message`, `errors`), jamais de trace, chemin serveur ou requête SQL (cf. §5 et §20).

## 15. Formulaires publics et anti-abus [ACTÉ]

Concerne : inscription d'établissement, « Dis-moi tout », devis, contact, newsletter, création de compte, avis, commentaires.

- **Cloudflare Turnstile** (ou équivalent) vérifié **côté serveur** sur chaque formulaire public ; échec ⇒ rejet.
- **Honeypot** en complément (champ caché ; remplacer l'ancien « Laissez ce champ vide si vous êtes humain »).
- Rate limiting par IP et par email (§18) ; plafond quotidien d'envois par adresse.
- **Consentement** horodaté (`consent_at` + `consent_logs`) avant tout enregistrement de données personnelles.
- **Idempotence** : un `Idempotency-Key` (UUID généré côté client) est accepté sur les `POST` de formulaire ; deux envois avec la même clé produisent une seule ligne.
- **Double opt-in** pour la newsletter ; lien de désinscription signé.
- Aucun envoi d'email « à un tiers saisi librement » (anti-relais de spam) : les emails partent vers l'adresse du demandeur (accusé), l'équipe ou le prestataire destinataire.
- L'inscription d'établissement crée une fiche `pending` : **jamais** publiée sans validation `admin` (RG1, contrainte base `modele.md` §3.2).

## 16. Fichiers et images [ACTÉ]

Concerne `media` (logos, couvertures, galeries, avatars) et `provider_documents` (agréments, RCCM).

| Règle | Images publiques | Justificatifs privés |
|---|---|---|
| Types autorisés (liste blanche, détectés par contenu) | JPEG, PNG, WebP, AVIF | PDF, JPEG, PNG |
| Taille max | 5 Mo | 10 Mo |
| Nombre max | 10 par fiche (galerie) | 5 par fiche |
| Stockage | Disque `public` (S3 R2 en prod) | **Disque privé**, jamais d'URL publique |
| Accès | URL du CDN | **URL signée temporaire** (≤ 10 min), après contrôle d'autorisation |
| Nom | Aléatoire (`hashName()` / ULID), jamais le nom d'origine (conservé en base pour affichage uniquement) | idem |
| Traitement | **Réencodage** (supprime EXIF, GPS, charges cachées) ; dimensions maximales | Aucun rendu côté navigateur sans téléchargement forcé (`Content-Disposition: attachment`) |

- Détection du type réel via `finfo`/signature (pas l'extension ni le `Content-Type`). Rejeter SVG (vecteur XSS) sauf passage par un assainisseur dédié.
- Aucun fichier uploadé n'est servi depuis un dossier exécutable ; aucun accès direct au disque applicatif depuis le web.
- Analyse antivirus (ClamAV) sur les justificatifs [HYPOTHÈSE, à évaluer].
- Les fichiers d'une fiche supprimée/anonymisée sont supprimés (`modele.md` §5.3).

## 17. Données personnelles et conformité [ACTÉ pour le principe]

- Cadre : loi ivoirienne n° 2013-450 du 19 juin 2013 (autorité : ARTCI) — **à valider avec un juriste** (déclaration/autorisation, mentions légales, politique de confidentialité).
- **Minimisation** : ne collecter que ce qui est nécessaire ; pas de champ « au cas où ».
- **Données les plus sensibles** : feedbacks (plaintes nominatives), devis, justificatifs légaux, identité des dirigeants, 2FA. Accès réservé, jamais exposé par l'API publique, jamais loguées.
- **IP** : formulaires publics ⇒ uniquement `ip_hash` (HMAC) ; IP brute seulement dans `audit_logs`, durée limitée (`modele.md` §6.4).
- **Droits des personnes** : accès/export, rectification, suppression via `sp_anonymize_user` ; délai de traitement documenté.
- **Dirigeants** : affichage public uniquement avec `provider_executives.is_visible = true` (consentement).
- **Rétention** : durées de `modele.md` §5.3, appliquées par des jobs planifiés testés.
- **Cookies/traceurs** : aucun traceur non essentiel sans consentement ; bandeau de consentement, option « refuser » aussi visible que « accepter » ; pas d'analytics avant consentement (ou analytics sans cookie).

## 18. Rate limiting et verrouillage [ACTÉ]

Limiteurs Laravel nommés (`RateLimiter::for`), clé = IP **et** identifiant ciblé, réponse `429` générique avec `Retry-After`. Valeurs par défaut [HYPOTHÈSE] :

| Endpoint | Limite |
|---|---|
| Connexion | 5 tentatives / minute / (IP + email) ; verrouillage progressif (1, 5, 15 min…) ; alerte après 10 échecs |
| Connexion `admin`/`editor` | 3 / minute ; 2FA : 5 essais puis verrouillage |
| Mot de passe oublié / renvoi de vérification | 3 / heure / email, 10 / heure / IP |
| Création de compte | 5 / heure / IP |
| Inscription d'établissement | 3 / jour / IP |
| « Dis-moi tout », devis, contact | 5 / heure / IP, 10 / jour / email |
| Avis, commentaires | 10 / jour / utilisateur |
| Newsletter | 5 / heure / IP |
| Recherche / proximité (public) | 60 / minute / IP |
| API globale (authentifiée) | 120 / minute / utilisateur |
| Export / actions admin massives | 10 / minute |

Cloudflare (WAF, règles de limitation, Bot Fight Mode) en première ligne ; le limiteur applicatif reste actif même si Cloudflare est contourné. L'IP réelle est lue via les en-têtes de confiance configurés (`TrustProxies` limité à Cloudflare), jamais via un en-tête client arbitraire.

## 19. CORS, headers HTTP et frontend [ACTÉ]

**CORS (API Laravel)** : liste blanche d'origines explicites par environnement (`https://protectici.ci`, `https://staging.…`, `http://localhost:3000` en local uniquement) ; `supports_credentials = true` **uniquement avec origines explicites** ; méthodes et en-têtes limités ; pas de `*`, pas de réflexion automatique de l'`Origin`.

**Headers (API et Next.js)** :

| Header | Valeur |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (preload après validation) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `frame-ancestors 'none'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | désactive par défaut caméra, micro, paiement ; `geolocation=(self)` seulement (recherche de proximité) |
| `Content-Security-Policy` | Stricte, avec **nonce** généré par middleware Next.js : `default-src 'self'` ; `script-src 'self' 'nonce-…'` (+ Turnstile) ; `img-src 'self' data: <CDN médias> <tuiles OSM>` ; `connect-src 'self' <API> <Nominatim>` ; `object-src 'none'` ; `base-uri 'self'` ; `form-action 'self'`. Pas de `unsafe-inline`/`unsafe-eval` en production. |
| `Cache-Control` | `no-store` sur les réponses authentifiées et les données personnelles |

**Next.js** :
- Jamais de secret dans une variable `NEXT_PUBLIC_*` (elles sont publiques et figées au build).
- Les composants serveur appellent l'API en retransmettant le cookie de session ; aucune clé API partagée côté client.
- Pas d'`innerHTML`/`dangerouslySetInnerHTML` sur du contenu non purifié ; liens externes avec `rel` sécurisé.
- Le middleware `/admin/*` redirige les non-authentifiés, mais **l'API refait toujours le contrôle**.
- Aucune route Next.js API (`/api/*`) ne contourne Laravel pour lire ou écrire en base.
- Désactiver `poweredByHeader`, ne pas exposer les source maps en production.

**Cartes (Leaflet/OSM)** : attribution « © OpenStreetMap » visible ; aucune donnée utilisateur envoyée au fournisseur de tuiles hors coordonnées de la vue ; User-Agent identifiable pour Nominatim, cache des résultats, 1 requête/seconde maximum.

## 20. Erreurs, logs et audit [ACTÉ]

- `APP_DEBUG=false` et `APP_ENV=production|staging` hors local ; `display_errors=Off`, `error_reporting` sans affichage ; **aucune erreur PHP affichée dans les réponses** (défaut grave de l'ancien site : chemins serveur et versions exposés).
- Gestionnaire d'exceptions unique qui renvoie un JSON générique (`500` : « Une erreur est survenue ») avec un identifiant de corrélation ; détails dans les logs serveur.
- **Redaction** : filtre de logs qui masque `password`, `token`, `authorization`, `cookie`, `secret`, `email`, `phone`, corps de formulaires. Jamais de dump de requête complète.
- **`audit_logs`** (append-only, `modele.md` §2.10) pour : connexions réussies/échouées sensibles, changements de rôle, validations/rejets de fiches, modération d'avis, accès aux justificatifs, exports, suppressions et anonymisations, modifications de `settings`. Valeurs sensibles exclues.
- Alertes (email/Slack) sur : pics de `401/403/429`, échecs 2FA répétés, création d'un `admin`, échec de sauvegarde, erreur `5xx` répétée.
- Pages `404`/`500` Next.js personnalisées, sans détail technique.
- Aucune route de diagnostic (`/phpinfo`, `/telescope`, `/horizon`, `/debugbar`) accessible en production sans authentification `admin` + 2FA ; idéalement désactivées.

## 21. Infrastructure, déploiement et dépendances [ACTÉ]

**Infrastructure** (détail dans les skills `containerize-for-dockploy` et `harden-dockploy-vps`) :
- VPS derrière **Cloudflare** ; ports 80/443 de l'origine **restreints aux IP Cloudflare** ; vérifier que **UFW seul ne bloque pas** un port publié par Docker (utiliser la chaîne `DOCKER-USER`) ; SSH par clé uniquement, pas de login root, `fail2ban`.
- **Panneau Dockploy non exposé publiquement** (accès par tunnel/VPN ou restriction d'IP).
- PostgreSQL **sans port publié** ; réseau Docker interne ; mot de passe unique par environnement.
- Conteneurs en **utilisateur non-root**, images à version épinglée, système de fichiers en lecture seule quand possible, pas de montage de la socket Docker.
- TLS Cloudflare en mode **Full (strict)** ; HTTP → HTTPS forcé.
- Staging **non indexé** et protégé (Cloudflare Access ou authentification) ; `robots.txt` + `X-Robots-Tag: noindex`. Staging et production ne partagent **ni base, ni secrets, ni bucket**.
- Variables **build-time vs runtime** séparées ; secrets uniquement dans l'environnement Dockploy ; rotation en cas de fuite supposée ; `.env.example` à placeholders.
- `.gitignore` obligatoire : `.env*` (sauf `.env.example`), `storage/*.key`, `*.pem`, dumps SQL, `node_modules`, `vendor`. `.dockerignore` équivalent. Contrôle de secrets en pré-commit/CI (gitleaks).
- Sauvegardes `pg_dump` quotidiennes **chiffrées**, copie hors serveur, test de restauration trimestriel.

**Dépendances** :
- `composer audit` et `npm audit` dans la CI ; mises à jour automatiques (Dependabot/Renovate) ; `composer.lock` et `package-lock.json` versionnés ; installations en mode figé (`--frozen-lockfile`, `composer install --no-dev` en prod).
- Dépendances **minimales** et justifiées (retour d'expérience : ~20 extensions WordPress = surface d'attaque énorme). Toute nouvelle dépendance est signalée avec sa maintenance, sa licence et ses CVE connues.
- Pas de paquet exécutant du code à l'installation sans revue ; épingler les actions CI par SHA.
- PHP, Node, PostgreSQL, images de base : versions supportées uniquement ; échéances de fin de support suivies.

## 22. Opérations sensibles et processus

**Idempotence et confirmation** :
- Il n'y a **aucun paiement** dans le périmètre actuel (`CLAUDE.md` §5.4). Si un paiement est un jour ajouté, il suivra la règle §10 (clé d'idempotence, webhooks signés, état déterministe) et fera l'objet d'une révision de ce document.
- **Suppression** : toujours logique (`deleted_at`) d'abord ; suppression physique uniquement par jobs de rétention ou `sp_anonymize_user`. Dans l'admin : confirmation explicite (saisie du nom de l'élément) pour supprimer une fiche, un utilisateur ou un référentiel.
- Actions de modération (approuver/rejeter, suspendre) : **idempotentes** (rejouer ne change rien, ne renvoie pas d'email en double) et journalisées.
- Opérations de masse (import, export, purge) : en file, avec aperçu, plafonds et journal.

**Anti-régressions issues de l'ancien site (interdit)** :
- Erreurs PHP « Deprecated/Warning » visibles en production.
- API listant les extensions/versions ; fichiers `readme.html`, `license.txt`, `debug.log` accessibles.
- Domaines de préproduction référencés dans les liens ou redirections de production.
- Données de test mélangées à du contenu réel.
- Trop de plugins tiers non audités.

**Incident de sécurité** (procédure minimale) : isoler → préserver les logs → révoquer sessions et clés (`php artisan key:generate` impose une planification, car cela invalide les données chiffrées ; privilégier la rotation ciblée) → corriger → restaurer si besoin → notifier les personnes concernées et l'autorité compétente si exigé par la loi → rédiger un retour d'expérience.

### Checklist de revue avant livraison (à cocher par l'IA et le relecteur)

- [ ] Toutes les entrées sont validées côté serveur en liste blanche (FormRequest).
- [ ] Aucune requête construite par concaténation ; aucun `eval`/`exec`/`unserialize` sur données externes.
- [ ] Chaque route protégée a une Policy ; un test couvre l'accès refusé (autre utilisateur, autre rôle, anonyme).
- [ ] Aucun ID séquentiel ne sert de secret ; suivi par référence exige un second facteur (email/jeton).
- [ ] `$fillable` explicite ; `role`, `status`, `is_visible`, `user_id` non assignables en masse.
- [ ] Sorties échappées ; contenu riche purifié côté serveur.
- [ ] Uploads : type réel, taille, renommage, réencodage, disque adapté (public/privé), URL signée pour le privé.
- [ ] Formulaires publics : Turnstile + honeypot + rate limit + consentement + idempotence.
- [ ] Cookies `HttpOnly`/`Secure`/`SameSite`, CSRF actif, aucun jeton dans le stockage navigateur.
- [ ] CORS en liste blanche ; headers de sécurité et CSP en place.
- [ ] Aucun secret dans le code, les logs, les `NEXT_PUBLIC_*` ni le dépôt ; `.env.example` à jour.
- [ ] Erreurs génériques côté client ; logs sans donnée sensible ; événements sensibles dans `audit_logs`.
- [ ] Données personnelles : minimisation, consentement, rétention, pas d'exposition par l'API publique.
- [ ] Suppressions logiques d'abord ; actions destructives confirmées ; actions de modération idempotentes.
- [ ] Nouvelles dépendances justifiées, à jour, sans CVE connue (`composer audit` / `npm audit` propres).
- [ ] Tests de sécurité ajoutés (autorisation, validation, rate limit) et passants.
- [ ] Tout écart ou doute est **signalé** dans la réponse.

---

## Points à valider

1. Durées de session, seuils de rate limiting et politique de mot de passe (valeurs par défaut ci-dessus).
2. 2FA : obligatoire pour `admin`/`editor`, optionnel pour `provider` — confirmer.
3. Antivirus ClamAV sur les justificatifs : nécessaire ou non.
4. Analytics (avec ou sans cookies) et contenu du bandeau de consentement.
5. Cloudflare Access (ou VPN) pour le staging et pour `/admin` en production.
6. Cadre légal ivoirien (loi 2013-450 / ARTCI) à faire confirmer par un juriste.
