# Plan d'implémentation — Import Excel des forces étatiques et des prestataires

> Statut : **proposition à valider** (2026-10-24). Contexte : `CLAUDE.md`, modèle : `modele.md` §2.5, sécurité : `security.md` §6, §16, §22.
> Légende : **[À TRANCHER]** décision du porteur attendue, la valeur proposée est appliquée par défaut.

## 1. Objectif

Permettre à l'administrateur de créer **en masse** des fiches de forces étatiques et de prestataires à partir d'un fichier Excel :

1. l'admin **télécharge un modèle Excel** (un par type de fiche) ;
2. il le **remplit** avec l'essentiel des informations ;
3. il le **téléverse**, voit un **aperçu** (lignes valides, erreurs, doublons probables) et **confirme** ;
4. les fiches sont créées ; elles sont ensuite **complétées** par l'admin (écran existant) ou par l'établissement lui-même, après **revendication** de sa fiche.

## 2. Constat dans le code actuel

| Sujet | État |
|---|---|
| Création de fiche par l'admin | **Absente** : les fiches naissent seulement par l'inscription d'un établissement (`RegisterEstablishment`, propriétaire obligatoire). L'admin peut modifier, valider, suspendre, supprimer. |
| Fiche sans propriétaire | Possible en base (`user_id` nullable sur `providers` et `state_forces`). |
| Rattachement d'une fiche existante à un compte | **Absent** : aucune revendication, aucun transfert de propriété. |
| Espace établissement | Existe : modification directe des champs libres, demandes de modification validées pour les champs sensibles, documents, médias. |
| Géocodage | Existe : `App\Services\Geocoding\NominatimGeocoder` (cache, 1 requête/s). |
| Lecture/écriture Excel | Aucune bibliothèque installée. |
| Règle de sécurité applicable | `security.md` §22 : opérations de masse **en file, avec aperçu, plafonds et journal** ; §6 : type réel du fichier, taille limitée, renommage, stockage hors dossier exécutable. |

## 3. Le fichier Excel

### 3.1 Format

- **`.xlsx` uniquement** [À TRANCHER : accepter aussi `.csv`]. Lu et généré avec **PhpSpreadsheet** (`phpoffice/phpspreadsheet`), qui sait produire des listes déroulantes.
- **Le modèle est généré par l'API à la demande**, pour que les listes (villes, communes, types, démarches, services) soient toujours celles de la base.
- Contenu du modèle :
  - feuille **« Fiches »** : une ligne d'en-tête figée, colonnes obligatoires marquées d'un astérisque et colorées, **listes déroulantes** sur les colonnes à valeur fermée, une ligne d'exemple factice ;
  - feuille **« Listes »** : valeurs autorisées (sert de source aux listes déroulantes) ;
  - feuille **« Mode d'emploi »** : format du téléphone, séparateur des valeurs multiples (`;`), règles des coordonnées, plafond de lignes.
- Les en-têtes sont en français ; l'API les reconnaît par libellé (insensible à la casse et aux accents), pas par position.

### 3.2 Colonnes — forces étatiques

| Colonne | Oblig. | Champ | Règle |
|---|---|---|---|
| Nom de la structure | ✅ | `name` | 3 à 200 caractères |
| Type de force | ✅ | `force_type_id` | liste déroulante (types existants) |
| Ville | ✅ | `city_id` | liste déroulante |
| Commune / quartier | | `district_id` | doit appartenir à la ville |
| Adresse | | `address` | |
| Description géographique | | `geo_description` | « À côté de… » |
| Téléphone | ⚠️ | `phone` | format ivoirien, normalisé en `+225XXXXXXXXXX` |
| Téléphone 2 | | `phone_alt` | idem |
| Numéro d'urgence | | `emergency_phone` | idem (accepte les numéros courts : 110, 111, 170, 180…) |
| E-mail | | `email` | |
| Démarches possibles | | `procedure_types` | plusieurs valeurs séparées par `;` |
| Ouvert 24 h/24 | | `is_open_24h` | Oui / Non |
| Latitude, Longitude | | `latitude`, `longitude` | les deux ou aucune ; bornées à la Côte d'Ivoire |
| Description | | `description` | texte nettoyé (aucun HTML) |

⚠️ Téléphone : facultatif en base pour une force étatique, mais **fortement conseillé** ; l'aperçu signale les lignes sans aucun numéro.

Les horaires détaillés (`opening_hours`) restent saisis dans l'admin : trop complexes pour une cellule.

### 3.3 Colonnes — prestataires

| Colonne | Oblig. | Champ | Règle |
|---|---|---|---|
| Raison sociale | ✅ | `name` | |
| Téléphone | ✅ | `phone` | obligatoire en base |
| Ville | ✅ | `city_id` | liste déroulante |
| Commune / quartier | | `district_id` | |
| Adresse, Description géographique | | `address`, `geo_description` | |
| Téléphone 2, Numéro d'urgence, WhatsApp | | `phone_alt`, `emergency_phone`, `whatsapp_number` | |
| E-mail, Site web | | `email`, `website_url` | URL http(s) |
| Types d'entreprise | | `company_types` | `;` |
| Services proposés | | `service_types` | `;` |
| Tarif de départ (FCFA) | | `price_from` | entier ≥ 0 |
| Latitude, Longitude | | | idem forces |
| Description | | `description` | |
| RCCM, N° d'agrément, Forme juridique | | `rccm`, `approval_number`, `legal_form` | [À TRANCHER] proposés en option : données sensibles, uniques en base ; jamais renvoyées dans l'aperçu au-delà du nécessaire, jamais loguées |

Dirigeants, réseaux sociaux, logo, documents : **hors import**, ajoutés ensuite par l'établissement ou l'admin.

## 4. Parcours dans l'admin

Nouvel écran **Admin › Établissements › Importer** :

1. **Choisir le type** (forces étatiques / prestataires) → bouton **« Télécharger le modèle »**.
2. **Téléverser** le fichier rempli, choisir le **statut des fiches créées** :
   - **« Publier directement »** (par défaut [À TRANCHER]) : fiches `approved` et visibles, puisque c'est l'admin qui valide (RG1 respectée) ; badge « vérifié » non posé ;
   - **« À valider »** : fiches `pending`, à approuver une par une ou en masse.
3. **Aperçu** (après analyse en file, rafraîchi automatiquement) :
   - compteurs : lignes valides / en erreur / doublons probables ;
   - tableau des erreurs : n° de ligne, colonne, message en français (« Ville inconnue : Abidajn », « Téléphone invalide ») ;
   - doublons probables : ligne du fichier ↔ fiche existante (même nom normalisé + même ville, ou même téléphone, e-mail, RCCM) ; choix par ligne : **ignorer** (défaut) ou **créer quand même** ;
   - bouton **« Télécharger le rapport d'erreurs »** : le fichier d'origine avec une colonne « Erreurs », pour corriger et réimporter.
4. **Confirmer** : seules les lignes valides et non ignorées sont créées. L'import de lignes en erreur est impossible : on corrige puis on réimporte.
5. **Résultat** : nombre de fiches créées, lien vers la liste filtrée sur cet import.
6. **Historique des imports** : date, auteur, type, compteurs, statut ; action **« Annuler l'import »** qui supprime (logiquement) les fiches de l'import **encore sans propriétaire et sans avis**.

## 5. Compléter les fiches après import

### 5.1 Par l'administrateur
L'écran de modification admin existe déjà ; à ajouter :
- filtre **« Fiches incomplètes »** (sans coordonnées, sans téléphone, sans description, sans services/démarches) ;
- filtre **« Importée par… »** (lot d'import) ;
- pointage sur carte quand le géocodage n'a rien trouvé (déjà prévu au `CLAUDE.md`).

### 5.2 Par l'établissement : revendication de sa fiche
Sans cette étape, une entreprise importée ne peut rien modifier et risque de créer une **deuxième fiche** en s'inscrivant.

1. Sur une fiche publique **sans propriétaire** : lien **« C'est votre établissement ? Revendiquez cette fiche »**.
2. L'utilisateur connecté (e-mail vérifié) remplit : sa qualité (responsable, employé, autre), un téléphone, un **justificatif** (agrément, extrait RCCM, carte professionnelle ou courrier officiel pour une force étatique), via le circuit de documents privés existant.
3. L'admin traite la demande dans un nouvel onglet **« Revendications »** : accepter (le compte devient propriétaire, rôle `provider` si besoin, e-mail envoyé) ou refuser avec motif (e-mail envoyé).
4. Ensuite, l'établissement utilise l'**espace prestataire existant** : champs libres modifiés directement, champs sensibles par demande de modification validée.
5. **Anti-doublon à l'inscription** : le formulaire d'inscription cherche une fiche proche (nom + ville, téléphone) et propose « Cette fiche existe déjà : la revendiquer » avant de créer.
6. Raccourci admin : **« Attribuer à un compte »** (par l'e-mail d'un compte existant), journalisé.

## 6. Conception technique

### 6.1 Base de données (migrations)
- `establishment_imports` : `id`, `type` (`provider`/`state_force`), `status` (`uploaded`, `analyzing`, `ready`, `importing`, `done`, `failed`, `cancelled`), `publish_mode`, `file_disk`, `file_path`, `original_name`, `rows_total`, `rows_valid`, `rows_invalid`, `rows_duplicate`, `rows_created`, `report` (jsonb : erreurs et doublons par ligne, **sans** données sensibles en clair), `created_by`, `confirmed_at`, `finished_at`, timestamps.
- `providers.import_id`, `state_forces.import_id` : FK nullable → `establishment_imports` ON DELETE SET NULL, indexées.
- `establishment_claims` : `id`, `claimable_type`, `claimable_id`, `user_id`, `submitter_role`, `phone`, `status` (`pending`/`approved`/`rejected`), `rejection_reason`, `reviewed_by`, `reviewed_at`, timestamps ; **unicité partielle** : une seule revendication `pending` par fiche et par utilisateur ; justificatifs rattachés par les documents privés.
- Mise à jour de `modele.md` (§2.5, index, rétention : fichiers d'import supprimés après 30 jours [À TRANCHER]).

### 6.2 API Laravel (`/api/v1/admin/...`, rôle `admin` uniquement)
| Méthode | Route | Rôle |
|---|---|---|
| GET | `establishment-imports/template/{type}` | Génère et renvoie le modèle `.xlsx` |
| POST | `establishment-imports` | Téléverse (type, mode de publication) → crée l'import, lance l'analyse en file |
| GET | `establishment-imports` / `{id}` | Historique / état et aperçu (paginé) |
| PATCH | `establishment-imports/{id}/rows` | Décisions sur les doublons (ignorer / créer) |
| POST | `establishment-imports/{id}/confirm` | Lance la création en file (idempotent) |
| GET | `establishment-imports/{id}/report` | Rapport d'erreurs `.xlsx` |
| POST | `establishment-imports/{id}/cancel` | Annule l'import (règle du §4.6) |
| POST | `establishments/{type}/{id}/claims` (utilisateur) | Revendiquer une fiche |
| GET/POST | `admin/claims`, `admin/claims/{id}/approve|reject` | Traiter les revendications |
| POST | `admin/establishments/{type}/{id}/owner` | Attribuer à un compte |

Découpage suivant les conventions du projet : FormRequests, services `EstablishmentImportTemplate`, `EstablishmentImportParser`, `EstablishmentImportValidator` (réutilise les règles de l'inscription), `EstablishmentImporter`, `ClaimService` ; jobs `AnalyzeEstablishmentImport`, `RunEstablishmentImport`, `GeocodeImportedEstablishment` ; Policies ; API Resources.

### 6.3 Traitement
- **Analyse** (job) : lecture en flux, valeurs calculées seulement (aucune formule évaluée), normalisation (espaces, casse, téléphones `+225`, Oui/Non), correspondance des listes **insensible aux accents et à la casse**, détection des doublons dans le fichier **et** en base.
- **Création** (job) : par paquets de 100 lignes en transaction ; slug unique ; `status`/`is_visible` selon le mode ; `user_id` nul ; `import_id` posé ; audit `establishment_imported` par lot (pas une entrée par champ). Relancer la confirmation ne crée rien en double.
- **Géocodage** : lignes sans coordonnées mises en file vers `NominatimGeocoder` (1 requête/s, cache), à partir de l'adresse + commune + ville ; en cas d'échec, la fiche apparaît dans « Fiches incomplètes ».
- **Index de recherche** : `search_vector` mis à jour par les triggers existants ; vider le cache public de l'annuaire en fin d'import.

### 6.4 Sécurité (`security.md`)
- Admin uniquement, contrôle côté API ; limite de débit sur le téléversement.
- Fichier : extension `.xlsx` **et** signature ZIP/OOXML vérifiée, **5 Mo** max, **2 000 lignes** max [À TRANCHER] ; stocké sur le disque **privé** sous un nom aléatoire.
- Protection des archives : refus si la taille décompressée dépasse un plafond (bombe ZIP), analyseur XML de PhpSpreadsheet (pas d'entités externes).
- Toutes les cellules traitées comme du texte non fiable : validation en liste blanche, HTML retiré, longueurs bornées.
- Rapport d'erreurs : les cellules commençant par `=`, `+`, `-`, `@` sont neutralisées (injection de formules dans Excel).
- Journal : import, confirmation, annulation, revendications et attributions dans `audit_logs` ; aucune donnée sensible (RCCM, agrément, téléphone) dans les logs applicatifs.

### 6.5 Front Next.js (admin)
- Page `/admin/etablissements/import` : choix du type, téléchargement du modèle, téléversement (composant fichier existant), aperçu, confirmation.
- Page `/admin/etablissements/import/[id]` : état en direct (rafraîchissement périodique pendant l'analyse et l'import), erreurs, doublons, rapport, annulation.
- Onglet « Revendications » dans l'admin ; bouton « Revendiquer » et formulaire sur les fiches publiques ; avertissement anti-doublon dans l'inscription.

## 7. Découpage en lots

| Lot | Contenu | Dépend de |
|---|---|---|
| **A. Fondations** | Ajout de PhpSpreadsheet, migrations, modèles, génération des deux modèles Excel + tests | — |
| **B. Analyse et aperçu** | Téléversement, contrôles de fichier, analyse en file, validation par ligne, doublons, rapport d'erreurs | A |
| **C. Création** | Confirmation, création par paquets, modes de publication, géocodage en file, annulation d'import, historique | B |
| **D. Écrans admin d'import** | Pages import + suivi, filtres « Fiches incomplètes » et « Lot d'import » | B (API), C |
| **E. Revendication** | Table, API, e-mails (nouveau modèle d'e-mail), onglet admin, bouton public, attribution par l'admin, anti-doublon à l'inscription | A (migrations) — **indépendant de B à D** |
| **F. Recette** | Tests E2E (import complet de 50 lignes factices, fichier piégé, revendication acceptée puis modification par l'établissement), mise à jour de `modele.md`, `security.md`, `plan_de_développement.md` | tous |

Une fois A posé, **B–C (API d'import)** et **E (revendication)** peuvent avancer en parallèle ; **D** suit l'API.

Tests attendus (règle `CLAUDE.md` §4.4) : succès, validation et autorisation pour chaque endpoint ; cas limites : en-têtes renommés ou déplacés, accents (« Yopougon » / « yopougon »), téléphones aux formats variés, commune d'une autre ville, doublon dans le fichier, fichier vide, 2 001 lignes, faux `.xlsx`, formules dans les cellules, double confirmation.

## 8. Décisions à prendre

| # | Question | Proposition par défaut |
|---|---|---|
| 1 | Fiches importées publiées tout de suite ? | **Oui**, choix laissé à chaque import (« Publier directement » / « À valider ») |
| 2 | Revendication des fiches par les établissements ? | **Oui** (sinon les entreprises importées ne peuvent rien compléter et risquent de créer des doublons) |
| 3 | Accepter aussi le `.csv` ? | Non, `.xlsx` seulement (listes déroulantes, moins d'erreurs d'encodage) |
| 4 | Plafonds | 2 000 lignes, 5 Mo par fichier |
| 5 | L'import peut-il **mettre à jour** des fiches existantes ? | **Non** en v1 : création seulement, doublons signalés ; la mise à jour en masse viendra plus tard si besoin |
| 6 | RCCM / n° d'agrément dans le modèle prestataire ? | Colonnes facultatives |
| 7 | Durée de conservation des fichiers importés | 30 jours, puis suppression automatique (le rapport en base reste) |
