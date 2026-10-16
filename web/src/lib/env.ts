/** Configuration publique lue depuis l'environnement (aucun secret ici). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  '',
);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === '1';
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === '1';

/** URL de l'API vue depuis le serveur Next (réseau interne éventuel). */
export function serverApiUrl(): string {
  return (process.env.API_INTERNAL_URL || API_URL).replace(/\/+$/, '');
}

/**
 * Clé de site Cloudflare Turnstile (publique par nature, jamais le secret). Lue à chaque appel
 * pour rester testable ; vide = Turnstile désactivé (le script Cloudflare n'est alors jamais chargé).
 */
export function turnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
}

/**
 * Photo d'arrière-plan du hero de l'accueil (publique, facultative). Seules les URL https (ou un
 * chemin local « /… ») sont acceptées ; vide ou invalide = aplat bleu seul. Son origine est ajoutée
 * automatiquement à la CSP img-src (voir proxy.ts / mediaOriginsFromEnv).
 */
export function heroImage(): { url: string; credit: string } | null {
  const url = (process.env.NEXT_PUBLIC_HERO_IMAGE_URL ?? '').trim();
  if (!url || !(/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url))) return null;
  return { url, credit: (process.env.NEXT_PUBLIC_HERO_IMAGE_CREDIT ?? '').trim() };
}
