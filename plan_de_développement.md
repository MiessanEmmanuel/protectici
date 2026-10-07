# plan_de_développement.md — Plan de développement ProtectIci

Contexte, stack et décisions : `CLAUDE.md`. Base de données : `modele.md`. Règles de sécurité (prioritaires) : `security.md`. Design : `design.md` (à venir).

**Principe** : cinq grandes phases, chacune livrant quelque chose d'utilisable et de testable. Objectif global : **parité fonctionnelle avec l'ancien site, en mieux** (design, qualité, sécurité), avec des données factices (cf. `CLAUDE.md` §2.1). Les évolutions fonctionnelles (paiement, mobile, etc.) sont hors plan (`CLAUDE.md` §5.4).

**Taille** : S ≈ quelques jours · M ≈ 1–2 semaines · L ≈ 2–4 semaines (travail à un développeur assisté par IA ; à recaler après la phase 1).

| # | Phase | Taille | Résultat |
|---|---|---|---|
| 1 | Fondations | M | Projet qui tourne en local, base complète, authentification, design system |
| 2 | Annuaire public | L | Recherche, fiches, carte et proximité fonctionnelles |
| 3 | Comptes, modération et relation client | L | Inscription d'établissement, avis, « Dis-moi tout », devis, admin de modération |
| 4 | Contenu éditorial et finitions fonctionnelles | M | Blog, pages, newsletter, back-office de contenu |
| 5 | Qualité, sécurité et mise en ligne | M | Tests, audit, performance, SEO, staging puis production |

---

## Phase 1 — Fondations

**Objectif** : un socle propre sur lequel les autres phases s'empilent sans reprise.

**Livrables**
- Monorepo `backend/` + `web/`, `.gitignore`, `.env.example`, Git initialisé, conventions de commit.
- `docker-compose.yml` local (PostgreSQL + PostGIS, backend, web) ; commandes de lancement validées et corrigées dans `CLAUDE.md` §6.2.
- Laravel API-only (`/api/v1`), Pint + Larastan, Pest ; Next.js (TypeScript, App Router), ESLint + Prettier, Vitest.
- **Toutes les migrations de `modele.md`** (extensions, tables, index, triggers, fonctions, rôles DB) et les seeders : `ReferenceSeeder` (référentiels) + `DemoSeeder` (données factices calquées sur l'ancien site).
- Authentification **Sanctum SPA** : inscription, connexion, déconnexion, vérification d'email (Resend), mot de passe oublié, rôles `user`/`provider`/`editor`/`admin`, 2FA pour l'admin, limiteurs de tentatives (`security.md` §12, §18).
- Squelette de sécurité : gestionnaire d'erreurs générique, CORS en liste blanche, headers + CSP, journal d'audit, redaction des logs.
- Client API typé côté Next.js, gestion de session, layouts public et admin vides.
- **`design.md` rédigé puis design system** : tokens (couleurs, typo, espacements), composants de base (boutons, champs, cartes, modales, tableaux, toasts), en-tête/pied de page, mode responsive mobile d'abord.
- CI (lint, tests, `composer audit`, `npm audit`, contrôle de secrets).

**Critères de sortie**
- `docker compose up` + deux commandes lancent le site et l'API ; `migrate --seed` produit un jeu de données complet.
- Un utilisateur s'inscrit, se connecte, se déconnecte ; un admin se connecte avec 2FA ; les tests d'autorisation de base passent.
- Aucune erreur PHP ou trace visible, quelle que soit la page.

**Dépendances / à trancher avant de démarrer** : directives de design du porteur (`design.md`) · nom de domaine (cookies, CORS) · choix du paquet spatial (`modele.md` §9).

---

## Phase 2 — Annuaire public

**Objectif** : le cœur du produit, utilisable par un visiteur anonyme.

**Livrables**
- **Annuaire des prestataires** : liste paginée, filtres (localisation, type d'entreprise, type de service, titre), tri, section « populaires », fiche complète (contact, réseaux, infos légales, dirigeants affichables, tarif de départ, médias, partage), compteur de vues.
- **Annuaire des forces étatiques** : filtres par type de force et type de démarche, fiche, horaires, numéros d'urgence.
- **Recherche par proximité** (PostGIS) : « près de moi » (géolocalisation navigateur) ou par ville/quartier ; **carte Leaflet + OpenStreetMap** avec regroupement de marqueurs ; géocodage Nominatim en cache ; correction du défaut « carte non chargée » de l'ancien site.
- Recherche plein texte et tolérante aux fautes (`modele.md` §4.2).
- Médias : stockage Laravel (disque local en dev, S3/R2 ensuite), réencodage des images.
- Favoris (utilisateur connecté), affichage des avis publiés (lecture seule à ce stade).
- Pages publiques d'accueil (recherche, populaires, blocs d'inscription), SEO de base (métadonnées, sitemap, données structurées `LocalBusiness`).
- Accessibilité et performance mobile vérifiées (Lighthouse, WCAG 2.1 AA visée).

**Critères de sortie**
- Les parcours « trouver un prestataire » et « trouver une force étatique » (`CLAUDE.md` §2.3) fonctionnent de bout en bout sur mobile et ordinateur, avec le jeu factice.
- Une recherche de proximité renvoie des résultats triés en mètres en moins de 300 ms sur le jeu de test.
- Tests API (succès, validation, autorisation) et E2E Playwright des deux parcours.

**Dépendances** : phase 1. **À trancher** : fournisseur de tuiles OSM pour la production (`CLAUDE.md` §3.1).

---

## Phase 3 — Comptes, modération et relation client

**Objectif** : tout ce qui crée de la donnée : inscription des établissements, avis, retours clients, devis, et l'outil d'administration pour les traiter.

**Livrables**
- **Inscription d'établissement** multi-étapes (prestataire ou administration étatique), téléversement des justificatifs privés, fiche créée en `pending`.
- **Back-office admin (modération)** : file des fiches à valider (approuver / rejeter avec motif), badge « vérifié », gestion des utilisateurs et rôles, référentiels, journal d'audit, notifications internes.
- **Espace prestataire** : modifier sa fiche (champs non sensibles), demandes de modification des champs sensibles (`provider_change_requests`), médias, réponse unique aux avis, devis reçus.
- **Avis** : note 1–5, un par utilisateur et prestataire, modération, signalement, réponse du prestataire, calcul automatique de la note moyenne.
- **« Dis-moi tout »** : formulaire multi-étapes (action, objet, prestation, sujet), numéro de référence, suivi par référence + email, traitement et réponses côté admin, envoi d'emails via Resend.
- **Demande de devis** (nouvelle version avec envoi à plusieurs prestataires) et **contact** ; relever d'abord les champs du formulaire de l'ancien site.
- Formulaires publics durcis : Turnstile, honeypot, rate limiting, consentement tracé, idempotence (`security.md` §15).
- Emails transactionnels (modèles en français) : vérification, validation/rejet de fiche, accusés de réception, réponses.

**Critères de sortie**
- Un établissement s'inscrit, un admin le valide, la fiche apparaît dans l'annuaire ; un avis est déposé, modéré, publié et reçoit une réponse.
- Un « Dis-moi tout » et un devis sont créés, traités et notifiés ; aucune donnée personnelle n'est exposée par l'API publique.
- Tests d'autorisation (IDOR, rôles) pour chaque ressource de la matrice `security.md` §13.

**Dépendances** : phases 1 et 2. **À trancher** : réponses aux questions ouvertes de `modele.md` §9 (avis sur les forces étatiques ? fiches multiples ?).

---

## Phase 4 — Contenu éditorial et finitions fonctionnelles

**Objectif** : la partie « média » du site et le reste de la parité avec l'ancien site.

**Livrables**
- **Blog** : liste, catégories (7), article, à la une, populaires, recherche, commentaires modérés, bandeau « Flash info », brouillons et planification.
- **Back-office de contenu** (rôle `editor`) : éditeur riche avec nettoyage HTML côté serveur, médias, catégories, modération des commentaires.
- **Pages institutionnelles** : Qui sommes-nous (valeurs, mission), Nos partenaires, Nos clients, mentions légales, politique de confidentialité, CGU.
- **Newsletter** : double opt-in, désinscription signée, synchronisation Resend.
- Paramètres du site (contacts, réseaux sociaux, adresse) pilotés depuis l'admin ; tableau de bord admin (compteurs, éléments en attente).
- Contenu factice français remplaçant le contenu anglais de démonstration de l'ancien site ; référentiels corrigés (fautes, doublons).
- Bandeau de consentement aux cookies et politique associée.

**Critères de sortie**
- Toutes les pages et fonctionnalités de l'ancien site ont leur équivalent, sans texte lorem ni contenu anglais de démonstration.
- Un `editor` publie un article sans accéder à l'annuaire ni aux données personnelles (test d'autorisation).

**Dépendances** : phase 1 (peut démarrer en parallèle de la phase 3 sur le front public).

---

## Phase 5 — Qualité, sécurité et mise en ligne

**Objectif** : passer d'une application qui fonctionne à une application que l'on peut exposer.

**Livrables**
- **Tests** : couverture des règles métier critiques, E2E Playwright des sept parcours (`CLAUDE.md` §2.3), tests de charge légers sur la recherche et la proximité.
- **Revue de sécurité** complète selon la checklist de `security.md` §22 (relecture du code, test d'intrusion basique : IDOR, XSS, CSRF, upload, énumération, rate limiting), correction des écarts.
- **Performance** : index vérifiés (`EXPLAIN`), cache des listes publiques, ISR Next.js, images optimisées, objectifs Core Web Vitals sur mobile.
- **SEO et accessibilité** : audit final, redirections depuis les anciennes URL WordPress, `sitemap.xml`, `robots.txt`.
- **Déploiement** : conteneurisation (`containerize-for-dockploy`), staging puis production sur VPS + Dockploy + Cloudflare, variables build/runtime, migrations au déploiement, durcissement du VPS (`harden-dockploy-vps`), sauvegardes chiffrées et test de restauration, supervision et alertes.
- **Documentation d'exploitation** : lancement, déploiement, restauration, rotation des secrets, procédure d'incident.
- Recette avec le porteur sur le staging, puis bascule du domaine.

**Critères de sortie**
- Checklist de sécurité entièrement cochée ; `composer audit` et `npm audit` propres ; aucune erreur technique visible en production.
- Restauration de sauvegarde testée ; staging et production isolés (bases, secrets, buckets).
- Recette validée par le porteur.

**Dépendances** : phases 1 à 4. **À trancher** : nom de domaine, hébergeur du VPS, plan de bascule depuis l'ancien site.

---

## Phase 6 — Méga-refonte visuelle (ajoutée le 2026-10-07)

**Contexte** : aucune des trois maquettes proposées n'a plu au porteur ; on construit d'abord le fonctionnel (phases 1 à 5), puis on refond le design.

**Conséquences sur les phases 1 à 5**
- L'interface est **neutre et sobre** (composants simples, aucune identité graphique poussée), mais **toute la mise en forme passe par des jetons** (variables CSS / thème Tailwind) et des composants réutilisables : changer le design = changer les jetons et le style des composants, pas les pages.
- Pas de `design.md` figé ni de design system complet en phase 1 : on conserve seulement le logo, la palette de marque et les règles d'accessibilité de `design.md`.
- Les critères de sortie « design » des phases 1 à 5 sont réduits à : lisible, responsive, accessible, sans texte lorem.

**Livrables de la phase 6**
- Direction visuelle validée avec le porteur (nouvelles maquettes, à partir de références qu'il fournira).
- `design.md` figé, design system complet (tokens, composants et leurs états, admin).
- Application du design sur toutes les pages, vérification d'accessibilité et de performance, version vectorielle du logo.

**Dépendance** : phases 1 à 4 terminées (peut chevaucher la phase 5).

---

## Transversal (à chaque phase)

- Aucune fonctionnalité n'est « terminée » sans tests passants, lint propre, vérification manuelle du parcours et respect de `security.md`.
- Mettre à jour `CLAUDE.md` (structure, commandes) et `modele.md` (si le schéma change) dans la même modification que le code.
- Toute évolution hors périmètre est proposée, pas implémentée (`CLAUDE.md` §5.4).

## Risques et parades

| Risque | Parade |
|---|---|
| Directives de design tardives | `design.md` en tête de phase 1 ; composants construits sur des tokens modifiables |
| Qualité du géocodage OSM en Côte d'Ivoire | Pointage manuel sur carte en admin ; coordonnées saisies à la main pour les forces étatiques |
| Quotas/politique d'usage des tuiles OSM | Fournisseur de tuiles à quota gratuit dès la préproduction |
| Cookies Sanctum et domaines différents | Domaine parent commun décidé dès la phase 1 |
| Champs inconnus de l'ancien site (devis, forces) | Relevé rapide au début des phases 2 et 3 |
| Dérive de périmètre | Hors-scope explicite dans `CLAUDE.md` §5.4 |

## Historique des décisions de développement

| Date | Décision | Justification |
|---|---|---|
| 2026-10-07 | Plan en cinq grandes phases | Demande du porteur : peu de phases, grandes et livrables |
| 2026-10-07 | ~~`design.md` rédigé en début de phase 1~~ → **annulé** : design différé, phase 6 « méga-refonte » ajoutée | Aucune maquette retenue ; le porteur veut le fonctionnel d'abord |
| 2026-10-07 | Interface neutre et mise en forme par jetons en phases 1 à 5 | Rendre la refonte peu coûteuse |
| 2026-10-07 | Back-office de modération en phase 3, back-office de contenu en phase 4 | La modération est indispensable dès que des données arrivent |
