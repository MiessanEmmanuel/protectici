/** Construction de la Content-Security-Policy (security.md §19). Pure et testable. */

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  apiOrigin: string;
  /** Origines supplémentaires d'images (CDN médias), séparées par des espaces. */
  mediaOrigins?: string;
  tileOrigins?: string;
  /** Autorise Cloudflare Turnstile (script + iframe) : seulement si la clé de site est définie. */
  turnstile?: boolean;
  /** `upgrade-insecure-requests` (défaut : oui) ; désactivé quand le site est servi en HTTP (liens temporaires). */
  upgradeInsecure?: boolean;
}

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export const OSM_TILES = 'https://tile.openstreetmap.org https://*.tile.openstreetmap.org';

/** Serveur de tuiles par défaut (OSM public, usage limité : à remplacer en production, CLAUDE.md §3.1). */
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Modèle d'URL de tuiles retenu (R38) : NEXT_PUBLIC_TILE_URL s'il s'agit d'un modèle https contenant
 * {z}, {x} et {y} (ex. MapTiler, Stadia Maps), sinon le serveur OSM par défaut. `{s}` est accepté
 * uniquement en tête de nom d'hôte (sous-domaines a/b/c).
 */
export function resolveTileUrl(raw = ''): string {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return DEFAULT_TILE_URL;
  if (!['{z}', '{x}', '{y}'].every((t) => v.includes(t))) return DEFAULT_TILE_URL;
  return tileOrigin(v) ? v : DEFAULT_TILE_URL;
}

/** Origine CSP d'un modèle de tuiles (`{s}.` en tête d'hôte → joker `*.`), ou null si invalide. */
function tileOrigin(template: string): string | null {
  const m = /^https:\/\/((?:\{s\}\.)?)([a-z0-9.-]+(?::\d+)?)(?:[/?]|$)/i.exec(template);
  if (!m) return null;
  try {
    const u = new URL(`https://${m[2]}`);
    return `https://${m[1] ? '*.' : ''}${u.host}`;
  } catch {
    return null;
  }
}

/** Origines CSP img-src des tuiles : celles d'OSM par défaut, sinon l'origine du fournisseur configuré. */
export function tileOriginsFromEnv(raw = ''): string {
  const url = resolveTileUrl(raw);
  if (url === DEFAULT_TILE_URL) return OSM_TILES;
  return tileOrigin(url) ?? OSM_TILES;
}

export function buildCsp({
  nonce,
  isDev,
  apiOrigin,
  mediaOrigins = '',
  tileOrigins = OSM_TILES,
  turnstile = false,
  upgradeInsecure = true,
}: CspOptions): string {
  const script = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`];
  if (turnstile) script.push(TURNSTILE_ORIGIN);
  if (isDev) script.push(`'unsafe-eval'`); // React en développement uniquement
  const connect = [`'self'`, apiOrigin];
  if (isDev) connect.push('ws://localhost:*', 'ws://127.0.0.1:*');
  const img = [`'self'`, 'data:', 'blob:', tileOrigins, apiOrigin, mediaOrigins].filter(Boolean);

  const directives: Record<string, string[]> = {
    'default-src': [`'self'`],
    'script-src': script,
    'style-src': isDev ? [`'self'`, `'unsafe-inline'`] : [`'self'`, `'nonce-${nonce}'`],
    'img-src': img,
    // Lecture des messages vocaux (« Dis-moi tout ») via des URL blob: créées côté client.
    'media-src': [`'self'`, 'blob:'],
    'font-src': [`'self'`],
    'connect-src': connect,
    'object-src': [`'none'`],
    'base-uri': [`'self'`],
    'form-action': [`'self'`],
    'frame-ancestors': [`'none'`],
    'worker-src': [`'self'`, 'blob:'],
  };
  if (turnstile) directives['frame-src'] = [TURNSTILE_ORIGIN];
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev && upgradeInsecure) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/**
 * Origines d'images supplémentaires à partir de l'environnement : NEXT_PUBLIC_MEDIA_ORIGINS
 * (séparées par des virgules ou des espaces) + origine de NEXT_PUBLIC_HERO_IMAGE_URL si elle est
 * absolue en https. Seules des origines https valides (ou http locales) sont retenues (pas de chemin, pas de joker
 * injecté par erreur) ; résultat dédupliqué, séparé par des espaces.
 */
export function mediaOriginsFromEnv(mediaOrigins = '', heroImageUrl = ''): string {
  const out = new Set<string>();
  for (const raw of mediaOrigins.split(/[\s,]+/)) {
    const v = raw.trim();
    if (!v) continue;
    if (/^https:\/\/\*\.[a-z0-9.-]+$/i.test(v)) {
      out.add(v.toLowerCase()); // sous-domaines explicitement autorisés (https://*.exemple.ci)
      continue;
    }
    try {
      const u = new URL(v);
      const localHttp = u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
      if (u.protocol === 'https:' || localHttp) out.add(u.origin);
    } catch {
      /* valeur ignorée */
    }
  }
  try {
    const hero = new URL(heroImageUrl.trim());
    if (hero.protocol === 'https:') out.add(hero.origin);
  } catch {
    /* URL relative ou vide : rien à ajouter */
  }
  return [...out].join(' ');
}
