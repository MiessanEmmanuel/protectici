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
