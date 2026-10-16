# Système d'interface v9 (méga-refonte, phase 6)

Référence visuelle : `design/maquette/landing-v9.html` · règles : `design.md` « Direction validée (v9) ».

## Règles

- Aplats pleins, **rayon 0**, **aucune ombre**, **aucun dégradé**, filets **2 px** encre (`border-2 border-ink`).
- Jetons dans `src/styles/theme.css` : `c1` bleu / `on-c1`, `c2` or / `on-c2` (texte nuit uniquement), `c3` nuit, `c4` sable, `ink`, `ink-2`. Les anciens noms (`primary`, `accent`, `night`, `line`…) sont des alias.
- Typo : Archivo (next/font, `--font-archivo`). Tailles : `text-hero`, `text-section`, `text-display`, `text-figure`, `text-label`.
- Utilitaires (`globals.css`) : `wrap` (conteneur 1200 px, gouttière 16 px), `eyebrow` (petites capitales), `heading-block` (titre 900 serré), `grid-ruled` (grille à filets, nombre de cellules libre), `link-stretched`, `placeholder-hatch`, `pi-fade`.
- Espacements : `py-section` (72 px), `min-h-tap` (44 px), `min-h-btn` (50 px), `h-header`, `scroll-mt-header`.
- Icônes `lucide-react` **avec parcimonie** (nav, flash info, actions, urgences, tuiles de services, badge vérifiée, note, barre mobile), toujours `aria-hidden="true"`. Pas d'icône devant les titres ni dans les listes.
- Images : `<img>` (pas `next/image`, qui injecte un style en ligne refusé par la CSP). Toute origine externe passe par `NEXT_PUBLIC_MEDIA_ORIGINS`.
- Aucun contenu masqué par une animation ; mouvement réduit respecté globalement.

## Composants

| Composant | Usage |
|---|---|
| `Button` / `ButtonLink` / `buttonClasses` | Variantes `solid` (encre), `light` (blanc sur aplat foncé), `accent` (or), `outline` (contour couleur courante) + alias `primary`, `secondary`, `ghost`, `danger`. Tailles `sm`, `md` (44 px), `lg` (50 px). |
| `Badge` (Tag.tsx) | Pastille en petites capitales ; tons `success`, `accent`, `neutral`, `danger`, `primary`, `night`. `Tag` : étiquette à contour. |
| `Eyebrow` | Libellé en petites capitales au-dessus d'un titre (pas un `<label>` de formulaire). |
| `Section` / `SectionHeader` | Section pleine largeur sur un ton (`t1`…`t5`) + en-tête titre 900 et lien « voir plus » fléché. |
| `tone.ts` | `toneClasses[t1..t5]` (fond + texte contrasté), `toneAt(séquence, i)`. |
| `Tile` / `TileLink` | Aplat simple ; tuile-lien de mosaïque (chiffre facultatif, libellé, icône). À placer dans `grid-ruled`. |
| `FicheCard` + `ficheActionClasses` | Fiche d'annuaire : monogramme/logo, titre en lien étiré, méta, « vérifiée », note, distance, actions directes. |
| `Field`, `Input`, `Select`, `Textarea` | Contrôles 50 px, filet 2 px, fond sable au focus (`controlClasses`). |
| `InlineField` + `inlineControlClasses` | Cellule de barre de recherche (hero) : libellé capitales + champ sans bord. |
| `Card` | Bloc blanc à filet 2 px. |

## Thème de l'administration (maquette `design/maquette/admin-v1.html`)

- `styles/admin.css`, entièrement scopé sous `[data-admin-theme="dark|light"]` (posé par `AdminShell`) : jetons `--a-*` (fonds, filets, texte, or, bleu, rayons `--a-r-lg/md/sm`, `--a-pill`) et redéfinition des jetons Tailwind (`--color-white` = panneau, `--color-ink` = texte, `--color-c4` = carte…) dans la coquille. Aucun effet sur les pages publiques.
- Sombre par défaut ; cookie `pi_admin_theme` (`lib/admin-theme.ts`) lu côté serveur par `app/admin/layout.tsx`.
- Classes repères sans style public, habillées dans l'admin : `ui-btn` + `ui-btn-<variante>`, `ui-badge` + `ui-badge-<ton>` (+ `ui-badge-dot`, masquée hors admin), `ui-tag`, `ui-control`, `ui-card`, `ui-subcard`, `ui-empty`, `ui-table`/`ui-thead`/`ui-th`, `ui-tablist`/`ui-tab`, `ui-modal`/`ui-modal-head`.
- `Card variant="subcard"` : sous-carte arrondie (`--a-r-md`) sur `bg-surface-alt` ; angles droits hors admin.

Mise en page : `components/layout` (`Header`/`Logo`, `HeaderNav` + `nav-links.ts`, `FlashBanner`, `Footer`, `MobileDock`). Hooks : `lib/use-reduced-motion.ts`, `lib/geolocation.ts` (position sur action explicite seulement).
