# design.md — Système et direction visuelle ProtectIci

Contexte, stack : `CLAUDE.md`. Règles de sécurité : `security.md`. Plan : `plan_de_développement.md`.

> **Décision du 2026-10-07 : aucune des trois maquettes (A, B, C) n'a été retenue. Le design est DIFFÉRÉ.** Le développement démarre par le **fonctionnel** avec une interface volontairement neutre et sobre ; une **méga-refonte visuelle** suivra une fois le fonctionnel en place (voir `plan_de_développement.md`, phase 6). Les sections ci-dessous (identité, palette de marque, contrastes, principes, accessibilité) restent valables ; les directions A/B/C sont **abandonnées** et conservées uniquement comme historique.
>
> **Statut précédent : v0.1 — EN TEST.** Les fondations (logo, palette, typographie, composants) sont posées d'après l'ancien site. **La direction visuelle n'est pas encore choisie** : trois directions sont comparables dans la maquette `design/maquette/index.html`. Après validation, ce fichier sera mis à jour (§9) et deviendra la référence figée pour le développement (phase 1).
> Légende : **[ACTÉ]** repris de l'ancien site ou décidé · **[À TESTER]** dépend de la direction choisie · **[HYPOTHÈSE]** proposition.

---

## 1. Principes

1. **Confiance avant tout** : c'est un annuaire de sécurité. Sobriété, lisibilité, information vérifiée mise en évidence (badge « Vérifié », avis modérés).
2. **Mobile d'abord** : l'usage en Côte d'Ivoire est majoritairement sur téléphone ; les actions clés (appeler, demander un devis, « près de moi ») tiennent au pouce.
3. **Le bleu et l'or du logo** restent l'identité ; on ne les trahit pas, on les structure (voir §3).
4. **Accessible** : WCAG 2.1 AA visée (contrastes mesurés §3.3, cibles tactiles ≥ 44 px, focus visible, pas d'information portée par la couleur seule).
5. **Léger** : peu de polices, pas d'effets lourds, images optimisées (réseau mobile).
6. **Zéro reprise des défauts de l'ancien site** : pas de texte lorem ni anglais, pas de blocs « Easily add or remove any text », pas de carte cassée.

---

## 2. Identité

### 2.1 Logo [ACTÉ — repris de l'ancien site]

| Élément | Détail |
|---|---|
| Symbole | Éléphant bleu, œil et défense **or**. |
| Mot-symbole | « PROTECTICI » en capitales hautes et condensées ; « PROTECT » en or, « ICI » en bleu (le « O » et le « I » final sont bleus : « ICI » est la partie mise en avant, « ici » = « here »). |
| Fichiers | `design/assets/logo-protectici.webp` (original, 1024×717, fond transparent) · `design/assets/logo-protectici.png` (copie) · `design/assets/elephant-icon-192.png` (icône/favicon, l'éléphant seul). |

**Constats et recommandations**
- Le logo actuel est un **rendu 3D raster avec ombre portée**. Il fonctionne sur fond blanc mais :
  - le bleu de « ICI » ressort mal sur fond sombre → **sur fond sombre, toujours le placer sur une pastille/plaque blanche** (déjà fait dans la maquette) ;
  - l'ombre et le relief ne se redimensionnent pas bien en petit (en-tête mobile).
- **[HYPOTHÈSE] À produire avant la mise en ligne** (par un graphiste ou redessin vectoriel) : version **SVG à plat** (sans ombre), **version horizontale** (éléphant à gauche, mot à droite) pour l'en-tête, version **monochrome** (blanc, bleu nuit) et **favicon** propre. Tant que ce n'est pas fait, on utilise le fichier actuel.
- Zone de protection : au moins la hauteur de la lettre « O » autour du logo. Hauteur minimale d'affichage : 48 px (en-tête), 32 px (icône seule).

### 2.2 Ton et contenu
Français clair, vouvoiement, phrases courtes, verbes d'action (« Rechercher », « Demander un devis », « Dis-moi tout »). Jamais de jargon sécuritaire inutile. Montants en **FCFA** (`90 000 FCFA`, espace insécable), numéros au format `+225 XX XX XX XX XX`, dates en français (`19 juillet 2024`).

---

## 3. Couleurs

### 3.1 Palette de marque [ACTÉ — relevée dans le thème de l'ancien site]

| Nom | Hex | Usage |
|---|---|---|
| **Bleu ProtectIci** | `#0343A4` | Couleur principale : liens, boutons, titres d'accent, avatars |
| **Or ProtectIci** | `#EAAB13` | Accent : appels à l'action, badges, étoiles, bandeau « Flash info » |
| **Nuit** | `#001029` | Texte principal, fonds sombres, pied de page |
| **Blanc** | `#FFFFFF` | Fonds, texte sur couleur |
| **Gris clair** | `#EDEDED` | Fonds secondaires, séparateurs |

### 3.2 Palette étendue [HYPOTHÈSE]

| Rôle | Hex | Note |
|---|---|---|
| Bleu 50 / 100 | `#EAF1FB` / `#D2E2F7` | Fonds teintés, tags, survols |
| Bleu 700 / 800 | `#02367F` / `#022A63` | Survol/appui des boutons bleus, dégradés |
| Bleu clair (sur fond sombre) | `#7FB0FF` | Liens sur fond nuit (contraste 8,64:1) |
| Or texte (sur clair) | `#8A6200` | **Seul or utilisable en texte sur blanc** (5,49:1) |
| Texte secondaire | `#4F5B70` | Sur blanc (≈ 6:1) |
| Succès | `#0F7B4F` (fond `#E3F5EC`) | Badge « Vérifié », confirmations |
| Danger | `#C62828` | Erreurs, suppression, plaintes |
| Bordures | `#D5DDEA` | Cartes et champs sur fond clair |

### 3.3 Contrastes mesurés (WCAG, seuil texte normal 4,5:1)

| Combinaison | Ratio | Verdict |
|---|---|---|
| Bleu `#0343A4` sur blanc | **8,96** | ✅ |
| Nuit `#001029` sur blanc | 18,99 | ✅ |
| Nuit sur or `#EAAB13` | **9,34** | ✅ (le bon pairage de l'or) |
| Or sur nuit | 9,34 | ✅ |
| Blanc sur bleu | 8,96 | ✅ |
| Bleu sur gris `#EDEDED` | 7,66 | ✅ |
| Or `#EAAB13` sur blanc | **2,03** | ❌ jamais en texte sur fond clair |
| Or sur bleu | 4,41 | ⚠️ limite : texte gras ≥ 18,66 px seulement |
| Or foncé `#8A6200` sur blanc | 5,49 | ✅ |

**Règles** : l'or sert de **fond** (avec texte nuit), de **bordure/icône décorative** ou de texte **sur fond sombre**. Jamais de texte or sur blanc. Les étoiles dorées sont toujours accompagnées de la note en chiffres.

---

## 4. Typographie

### 4.1 Constats
- L'ancien site utilise **Red Hat Display** (titres/texte) et **Plus Jakarta Sans** (accent), via Elementor. Le mot-symbole du logo est en capitales **hautes et condensées**.
- Demande du porteur : une **typographie « de sécurité »** = forte, droite, institutionnelle. D'où des titres en **capitales condensées** (écho du logo), associés à une police de texte neutre très lisible.

### 4.2 Choix par direction [À TESTER]

| Direction | Titres | Texte | Libellés techniques |
|---|---|---|---|
| **A · Institutionnel** | **Barlow Condensed** 700, capitales | **Inter** 400–700 | Inter |
| **B · Centre de commandement** | **Oswald** 600, capitales | **Inter** | **IBM Plex Mono** (références, distances, étiquettes) |
| **C · Proximité** | **Sora** 700, casse normale | **Plus Jakarta Sans** (déjà utilisée sur l'ancien site) | Plus Jakarta Sans |

Toutes sont libres (Google Fonts / OFL) → **auto-hébergées** via `next/font` en production (performance, confidentialité, pas d'appel à Google).

### 4.3 Échelle [HYPOTHÈSE]

| Niveau | Mobile | Bureau | Usage |
|---|---|---|---|
| Display (h1 accueil) | 40 px | 64–76 px | Hero uniquement |
| H1 page | 30 px | 44–48 px | Titre de page/fiche |
| H2 section | 30 px | 40–44 px | Sections |
| H3 carte | 20–22 px | 22–24 px | Titres de cartes |
| Corps | 16 px | 16–18 px | Texte courant (interligne 1,55–1,65) |
| Petit | 13–14 px | 14 px | Métadonnées, tags (jamais < 12 px) |

Largeur de ligne maximale 65–70 caractères. Pas de texte justifié.

---

## 5. Espacements, formes, ombres

| Jeton | A · Institutionnel | B · Commandement | C · Proximité |
|---|---|---|---|
| Rayon contrôle | 8 px | 2 px | pilules (999 px) |
| Rayon carte | 12 px | 4 px | 24 px |
| Ombre carte | douce, 2 niveaux | aucune (bordure 1 px) | douce et teintée de bleu |
| Densité | aérée | dense, « tableau de bord » | très aérée, grandes cibles |

Échelle d'espacement commune (multiples de 4) : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Conteneur : 1180 px max, gouttières 24 px (16 px mobile). Sections : 64 px de marge verticale (44 px mobile).

---

## 6. Composants [ACTÉ pour la liste, style À TESTER]

Chaque composant est déjà esquissé dans la maquette (états à compléter à la validation : survol, focus, désactivé, chargement, erreur).

| Composant | Notes |
|---|---|
| **Bouton** (principal, doré, contour, petit) | Zone ≥ 44 px ; un seul bouton principal par zone ; libellé verbe d'action. |
| **Champ de recherche multi-critères** | Localisation, type de service, nom ; cœur du produit, toujours en haut de l'accueil et de l'annuaire. |
| **Puce / tag** | Services, catégories ; version « filtre actif » avec croix. |
| **Badge « Vérifié »** | Vert + icône ; jamais uniquement la couleur. |
| **Étoiles + note** | Note en chiffres toujours affichée à côté. |
| **Carte prestataire** | Avatar/logo, nom, note, badge, lieu, téléphone, 3 services max, tarif de départ, lien. |
| **Ligne force étatique** | Pictogramme, nom, type/démarches, **distance** (« 0,8 km »). |
| **Carte OpenStreetMap** | Marqueurs bleus, position utilisateur en or, attribution « © OpenStreetMap » visible, carte alternative textuelle (liste). |
| **Tuile « Dis-moi tout »** | Quatre actions : encouragement, question, plainte, suggestion. |
| **Bandeau « Flash info »** | Or/nuit, défilement **pausable** (respecter `prefers-reduced-motion`). |
| **Formulaire multi-étapes** | Indicateur d'étapes, validation par étape, messages d'erreur sous le champ, résumé final, numéro de suivi. |
| **Avis** | Note, texte, date, réponse du prestataire en retrait avec filet or ; mention « publié après modération ». |
| **Tableau clé/valeur** | Informations légales (forme juridique, capital, RCCM, agrément…). |
| **Carte article de blog** | Image 16:10, catégorie en tag, titre, date, vues. |
| **En-tête / pied de page** | En-tête : logo, navigation (Accueil, À propos, Demande de devis, Prestataires, Forces étatiques, Dis-moi tout, Contact), « Se connecter ». Pied : à propos, infos utiles, newsletter. |
| **Navigation mobile** | Menu burger plein écran ; actions principales accessibles sans ouvrir le menu. |
| **Toasts, modales, tableaux d'admin, états vides, squelettes de chargement** | À spécifier à la validation (back-office inclus). |

**Iconographie** : jeu unique, trait 2 px, coins arrondis (style Lucide) ; icônes décoratives masquées aux lecteurs d'écran, icônes porteuses de sens avec libellé.

**Images** : photos locales (agents, équipements, Abidjan) de préférence aux photos de banque d'images génériques ; format WebP/AVIF, `alt` obligatoire, ratio 16:10 pour les articles, carré pour les avatars.

---

## 7. Mise en page [HYPOTHÈSE]

- **Accueil** : en-tête → bandeau Flash info → hero avec recherche → chiffres clés → prestataires populaires → forces les plus proches (liste + carte) → « Dis-moi tout » → bandeau d'inscription → blog → pied de page.
- **Fiche prestataire** : fil d'Ariane → en-tête (logo, nom, note, badges, favori, partage) → colonne principale (présentation, services, infos légales, dirigeants affichables, avis) + colonne latérale collante (devis, appel, coordonnées, mini-carte, « Dis-moi tout »).
- **Points de rupture** (largeur du conteneur) : ≥ 1100 px menu complet · ≤ 980 px 2 colonnes, menu burger · ≤ 640 px 1 colonne, cibles agrandies.
- **Admin** : thème sobre (réutilise tokens de la direction retenue), navigation latérale, tableaux denses, couleurs d'état normalisées. À spécifier après validation.

---

## 8. Accessibilité et performance

- Contrastes validés (§3.3) ; focus visible 3 px en or ; navigation clavier complète ; `lang="fr"` ; libellés de formulaires associés ; erreurs annoncées (`aria-live`).
- Mouvement : animations courtes (≤ 200 ms), désactivées avec `prefers-reduced-motion` ; défilement du Flash info pausable.
- Pas de dépendance à la couleur seule ; texte redimensionnable jusqu'à 200 %.
- Performance : polices auto-hébergées avec `display: swap`, deux familles maximum par direction, images adaptatives, LCP visé < 2,5 s sur mobile.
- Mode sombre : **non prévu en V1** (la direction B est un parti pris visuel, pas un thème commutable) [HYPOTHÈSE].

---

## 9. Directions en test et processus de validation

### 9.1 Maquette
Fichier : `design/maquette/index.html` (HTML/CSS statique, données **factices**). Boutons en haut : **direction** (A/B/C, ou touches `1` `2` `3`), **page** (Accueil / Fiche prestataire), **écran** (ordinateur / mobile). Lancement :

```bash
cd design && python3 -m http.server 8765
# puis ouvrir http://127.0.0.1:8765/maquette/index.html
```

### 9.2 Les trois directions

| | **A · Institutionnel** | **B · Centre de commandement** | **C · Proximité** |
|---|---|---|---|
| Ambiance | Clair, sérieux, rassurant, proche d'un site d'institution | Sombre, tactique, « salle de contrôle » | Chaleureux, arrondi, façon application |
| Fond | Blanc / bleu très pâle | Nuit `#001029` | Gris-bleu très clair, hero bleu |
| Bouton principal | Bleu | **Or** | Or (sur hero bleu) / bleu |
| Titres | Capitales condensées (Barlow Condensed) | Capitales condensées (Oswald) + libellés mono | Casse normale géométrique (Sora) |
| Forces | Lisible, neutre, fidèle au logo sur blanc, facile à décliner en admin | Forte identité « sécurité », met l'or en valeur | Très accessible au grand public, mobile naturel |
| Risques | Un peu classique | Logo à mettre sur plaque blanche ; texte long fatigant ; moins « public » | Moins « institutionnel » pour un annuaire d'agréments |
| Typo « de sécurité » | ✅ | ✅✅ | ➖ |

[HYPOTHÈSE] Recommandation provisoire : **A** comme base (fiabilité, lisibilité, cohérence avec le logo), en empruntant à **B** le bandeau et les libellés techniques, et à **C** la douceur des cartes sur mobile. À trancher avec le porteur.

### 9.3 Itération
1. Le porteur regarde la maquette (accueil + fiche, ordinateur et mobile) et indique : direction retenue ou mélange, ce qui plaît/déplaît.
2. J'ajuste la maquette (couleurs, typographie, densité, composants) et la teste de nouveau.
3. À validation : le choix est figé ici (§4.2, §5 réduits à **une** direction), les états de composants et le design de l'admin sont spécifiés, et un `tokens` (CSS variables / Tailwind) est généré pour `web/`.
4. Journal des décisions de design ci-dessous.

### 9.4 Journal des décisions de design

| Date | Décision | Justification |
|---|---|---|
| 2026-10-07 | Palette et logo repris de l'ancien site | Demande du porteur ; identité déjà établie |
| 2026-10-07 | Or interdit en texte sur fond clair | Contraste mesuré 2,03:1 |
| 2026-10-07 | Titres en capitales condensées (A, B) | Demande de typographie « de sécurité », écho du mot-symbole |
| 2026-10-07 | Logo sur plaque blanche sur fond sombre | Le bleu de « ICI » est illisible sur nuit |
| 2026-10-07 | Trois directions testées en maquette avant tout développement | Éviter de refaire les composants (plan, phase 1) |

---

## 10. Questions ouvertes

1. Direction retenue (A, B, C ou mélange) ?
2. Le logo actuel est-il à conserver tel quel, ou faut-il une version vectorielle/horizontale (nous pouvons la préparer) ?
3. Photographies : disposez-vous d'images propres (agents, équipements, Abidjan) ou utilise-t-on des illustrations/placeholders pour l'instant ?
4. Un mode sombre commutable est-il souhaité ?
