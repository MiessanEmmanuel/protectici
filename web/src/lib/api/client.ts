'use client';

import { API_URL, USE_MOCKS } from '../env';
import { mockApi } from '../mocks/mock-api';
import { buildApi, type Api } from './endpoints';
import { createRequester } from './http';

/** Client API pour les composants clients (cookies Sanctum + CSRF). */
export const clientApi: Api = USE_MOCKS
  ? mockApi
  : buildApi(createRequester({ baseUrl: API_URL, timeoutMs: 15000 }));
