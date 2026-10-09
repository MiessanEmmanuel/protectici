import { ApiError, genericMessage } from './errors';

export type QueryValue = string | number | boolean | string[] | undefined | null;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Envoi multipart (uploads) : l'en-tête Content-Type (avec boundary) est posé par le navigateur. */
  formData?: FormData;
  /** `blob` : renvoie le flux brut (téléchargement d'un justificatif). Défaut : JSON. */
  responseType?: 'json' | 'blob';
  signal?: AbortSignal;
  /** Secondes de cache serveur pour les lectures publiques anonymes (défaut 60). */
  revalidate?: number;
  idempotencyKey?: string;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Exécute une requête et renvoie le JSON décodé (undefined pour 204/202 sans corps). */
export type Requester = <T = unknown>(
  method: Method,
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export interface RequesterConfig {
  /** Origine de l'API, ex. http://localhost:8000 */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Côté serveur : renvoie l'en-tête Cookie de la requête entrante (ou null). */
  getCookieHeader?: () => Promise<string | null>;
  /** Lecture du cookie XSRF-TOKEN (par défaut document.cookie côté navigateur). */
  readXsrfCookie?: () => string | null;
  timeoutMs?: number;
}

const API_PREFIX = '/api/v1';

export function buildQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function defaultReadXsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice('XSRF-TOKEN='.length));
  } catch {
    return null;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const fromBody = typeof record.message === 'string' ? record.message : '';
  // Jamais de message serveur pour les 5xx : texte générique (security.md §20).
  const message = response.status >= 500 || !fromBody ? genericMessage(response.status) : fromBody;
  const rawErrors =
    response.status === 422 && record.errors && typeof record.errors === 'object'
      ? (record.errors as Record<string, unknown>)
      : {};
  const errors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(rawErrors)) {
    if (Array.isArray(messages)) errors[field] = messages.filter((m) => typeof m === 'string');
  }
  return new ApiError(
    response.status,
    message,
    errors,
    parseRetryAfter(response.headers.get('Retry-After')),
    typeof record.code === 'string' ? record.code : null,
  );
}

export function createRequester(config: RequesterConfig): Requester {
  const fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  const readXsrf = config.readXsrfCookie ?? defaultReadXsrfCookie;
  const isServer = typeof window === 'undefined';
  let csrfPromise: Promise<void> | null = null;

  async function ensureCsrf(force = false): Promise<void> {
    if (!force && readXsrf()) return;
    if (!csrfPromise || force) {
      csrfPromise = (async () => {
        const res = await fetchImpl(`${config.baseUrl}/sanctum/csrf-cookie`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw await toApiError(res);
      })().finally(() => {
        csrfPromise = null;
      });
    }
    await csrfPromise;
  }

  async function send(method: Method, path: string, options: RequestOptions, retried: boolean) {
    const url = `${config.baseUrl}${path.startsWith('/sanctum') ? '' : API_PREFIX}${path}${buildQueryString(options.query)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const init: RequestInit & { next?: { revalidate: number } } = {
      method,
      headers,
      credentials: 'include',
      signal: options.signal,
    };

    const mutating = method !== 'GET';
    if (mutating) {
      if (!isServer) {
        await ensureCsrf();
        const token = readXsrf();
        if (token) headers['X-XSRF-TOKEN'] = token;
      }
      if (options.formData) {
        init.body = options.formData;
      } else if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
      }
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    }

    if (isServer && config.getCookieHeader) {
      const cookie = await config.getCookieHeader();
      if (cookie) {
        headers.Cookie = cookie;
        init.cache = 'no-store'; // réponse potentiellement personnalisée
      } else if (!mutating) {
        init.next = { revalidate: options.revalidate ?? 60 };
      }
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (!options.signal && config.timeoutMs) {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      init.signal = controller.signal;
    }

    let response: Response;
    try {
      response = await fetchImpl(url, init);
    } catch {
      throw new ApiError(0, genericMessage(0));
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (response.status === 419 && mutating && !retried && !isServer) {
      await ensureCsrf(true);
      return send(method, path, options, true);
    }
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204 || response.status === 205) return undefined;
    if (options.responseType === 'blob') return response.blob();
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(500, genericMessage(500));
    }
  }

  return ((method, path, options = {}) => send(method, path, options, false)) as Requester;
}
