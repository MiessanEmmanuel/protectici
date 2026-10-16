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
}

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export const OSM_TILES = 'https://tile.openstreetmap.org https://*.tile.openstreetmap.org';

export function buildCsp({
  nonce,
  isDev,
  apiOrigin,
  mediaOrigins = '',
  tileOrigins = OSM_TILES,
  turnstile = false,
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
  if (!isDev) parts.push('upgrade-insecure-requests');
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
