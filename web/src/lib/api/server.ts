import { cookies } from 'next/headers';
import { serverApiUrl, USE_MOCKS } from '../env';
import { mockApi } from '../mocks/mock-api';
import { buildApi, type Api } from './endpoints';
import { createRequester } from './http';

/**
 * Client API pour les composants serveur : retransmet le cookie de session de la requête
 * entrante (jamais de jeton exposé au JS). Ne l'importez pas depuis un composant client.
 */
async function getCookieHeader(): Promise<string | null> {
  const store = await cookies();
  const sessionName = process.env.SESSION_COOKIE_NAME || 'protectici_session';
  if (!store.has(sessionName)) return null; // anonyme : cache serveur autorisé
  return store
    .getAll()
    .filter((c) => c.name === sessionName || c.name === 'XSRF-TOKEN')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Secret partagé avec l'API (variable SERVEUR, jamais NEXT_PUBLIC_*) : permet à l'API de distinguer le rendu serveur
 * (une seule IP pour tous les visiteurs) des navigateurs, pour lui appliquer un plafond de lecture distinct.
 */
function serverHeaders(): Record<string, string> {
  const secret = process.env.SSR_SHARED_SECRET;
  return secret ? { 'X-SSR-Secret': secret } : {};
}

export const serverApi: Api = USE_MOCKS
  ? mockApi
  : buildApi(createRequester({ baseUrl: serverApiUrl(), getCookieHeader, serverHeaders, timeoutMs: 8000 }));
