# ProtectIci — Front (Next.js)

Site public + zone d'administration protégée de ProtectIci. Next.js (App Router, TypeScript strict), Tailwind CSS, Leaflet/OpenStreetMap. Le front ne contient aucune logique métier : tout passe par l'API Laravel (`../backend`, contrat dans `../docs/api-contract.md`).

## Prérequis

Node 26 (ou ≥ 20), npm 11.

## Lancement

```bash
cp .env.example .env.local     # puis ajuster si besoin
npm install

# Mode mock : aucune API requise (données factices locales)
NEXT_PUBLIC_USE_MOCKS=1 npm run dev        # http://localhost:3000

# Mode réel : API Laravel sur http://localhost:8000
NEXT_PUBLIC_USE_MOCKS=0 npm run dev
```

Pour que les cookies Sanctum fonctionnent, web et API doivent partager le domaine parent (`localhost:3000` ↔ `localhost:8000` convient en local). Côté API : `SANCTUM_STATEFUL_DOMAINS=localhost:3000`, CORS avec `supports_credentials=true`.

> Les variables `NEXT_PUBLIC_*` sont figées au **build** : relancer `npm run build` après les avoir changées.

### Comptes du mode mock

| E-mail saisi | Rôle | Particularités |
|---|---|---|
| commence par `admin` | admin | 2FA demandée, code `123456` |
| commence par `editor` | editor | 2FA demandée, code `123456` |
| autre | user | — |

Mot de passe : 8 caractères minimum (connexion), 10 (inscription). `pris@example.test` simule un e-mail déjà utilisé. La session simulée est un cookie `mock_state` non sensible (jamais de jeton, jamais en production).

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | développement, build, serveur de production |
| `npm run lint` | ESLint (config Next + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest + Testing Library |
| `npm run format` | Prettier |

## Variables d'environnement

Voir `.env.example`. Jamais de secret dans une variable `NEXT_PUBLIC_*`.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL de l'API (CSP `connect-src`/`img-src`, requêtes navigateur) |
| `API_INTERNAL_URL` | URL de l'API vue par le serveur Next (optionnelle) |
| `NEXT_PUBLIC_USE_MOCKS` | `1` = données factices |
| `NEXT_PUBLIC_SITE_URL` | URL publique (sitemap, métadonnées, partage) |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `1` uniquement en production (sinon `noindex`, `robots.txt` Disallow) |
| `SESSION_COOKIE_NAME` | nom du cookie de session Laravel (confort UX du proxy `/admin`, `/compte`) |
| `NEXT_PUBLIC_MEDIA_ORIGINS` | origines supplémentaires d'images pour la CSP (CDN médias), optionnel |

## Structure

```
src/app/            pages (App Router), proxy.ts (CSP à nonce + garde UX), sitemap, robots
src/components/ui/  composants réutilisables (Button, Field/Input/Select/Checkbox, Card, Tag/Badge,
                    Pagination, Modal, Toast, Spinner/Skeleton, RatingStars, EmptyState…)
src/components/…    layout, directory (cartes, filtres, proximité), map (Leaflet), auth, account
src/lib/api/        client API typé (types, erreurs, http + CSRF, endpoints, client/serveur)
src/lib/mocks/      fixtures et API simulée (même interface que l'API réelle)
src/styles/theme.css  JETONS de thème : seul fichier à changer pour la refonte visuelle (phase 6)
tests/              Vitest
```

## Notes de conception

- **Rendu dynamique** : la CSP à nonce (`src/proxy.ts`) impose un rendu à la requête (pas de HTML statique/ISR). Les lectures publiques anonymes sont mises en cache côté serveur par `fetch` (`revalidate`), les requêtes avec cookie de session ne le sont pas.
- **Client API** : `src/lib/api/server.ts` (composants serveur, retransmet le cookie de session) et `src/lib/api/client.ts` (navigateur, `credentials: 'include'` + `X-XSRF-TOKEN`). Les pages ne connaissent pas le mode mock.
- **Cartes** : tuiles `tile.openstreetmap.org` (usage limité : choisir un fournisseur en production, `src/lib/csp.ts` et `MapView.tsx`), icônes locales dans `public/map/`.
- Aucune police externe (polices système) ; le logo est `public/logo-protectici.webp` (copie).
