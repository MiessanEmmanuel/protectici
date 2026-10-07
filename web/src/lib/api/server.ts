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

export const serverApi: Api = USE_MOCKS
  ? mockApi
  : buildApi(createRequester({ baseUrl: serverApiUrl(), getCookieHeader, timeoutMs: 8000 }));
