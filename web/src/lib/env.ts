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
