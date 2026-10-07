import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { buildApi } from '@/lib/api/endpoints';
import { buildQueryString, createRequester } from '@/lib/api/http';

function jsonResponse(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(responses: Response[], xsrf: { value: string | null } = { value: null }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('plus de réponse simulée');
    // la réponse csrf-cookie « pose » le cookie XSRF-TOKEN
    if (String(url).endsWith('/sanctum/csrf-cookie')) xsrf.value = 'jeton%20csrf';
    return next;
  }) as unknown as typeof fetch;
  const req = createRequester({
    baseUrl: 'http://api.test',
    fetchImpl,
    readXsrfCookie: () => (xsrf.value ? decodeURIComponent(xsrf.value) : null),
  });
  return { req, calls, api: buildApi(req) };
}

describe('client API : CSRF et cookies', () => {
  it('récupère /sanctum/csrf-cookie puis envoie X-XSRF-TOKEN avec credentials include', async () => {
    const { api, calls } = setup([jsonResponse(204), jsonResponse(200, { two_factor: true })]);
    const res = await api.login({ email: 'a@b.co', password: 'secret1234' });
    expect(res).toEqual({ kind: 'two_factor' });
    expect(calls[0]!.url).toBe('http://api.test/sanctum/csrf-cookie');
    expect(calls[1]!.url).toBe('http://api.test/api/v1/auth/login');
    const headers = calls[1]!.init.headers as Record<string, string>;
    expect(headers['X-XSRF-TOKEN']).toBe('jeton csrf');
    expect(headers.Accept).toBe('application/json');
    expect(calls[1]!.init.credentials).toBe('include');
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      email: 'a@b.co',
      password: 'secret1234',
    });
  });

  it('ne demande pas le cookie CSRF pour une lecture GET', async () => {
    const { api, calls } = setup([jsonResponse(200, { data: { cities: [] } })]);
    await api.getReferenceData();
    expect(calls).toHaveLength(1);
    expect((calls[0]!.init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined();
    expect(calls[0]!.init.credentials).toBe('include');
  });

  it('rejoue une fois la requête après un 419 en rafraîchissant le cookie CSRF', async () => {
    const { api, calls } = setup([
      jsonResponse(204), // csrf
      jsonResponse(419, { message: 'CSRF token mismatch.' }),
      jsonResponse(204), // csrf à nouveau
      jsonResponse(204), // logout OK
    ]);
    await api.logout();
    expect(calls.map((c) => c.url.replace('http://api.test', ''))).toEqual([
      '/sanctum/csrf-cookie',
      '/api/v1/auth/logout',
      '/sanctum/csrf-cookie',
      '/api/v1/auth/logout',
    ]);
  });

  it("transmet la clé d'idempotence", async () => {
    const { api, calls } = setup([
      jsonResponse(204),
      jsonResponse(202, {
        message:
          'Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte.',
      }),
    ]);
    const message = await api.register(
      {
        first_name: 'A',
        last_name: 'B',
        email: 'a@b.co',
        password: 'x',
        password_confirmation: 'x',
        consent: true,
      },
      'uuid-1',
    );
    expect((calls[1]!.init.headers as Record<string, string>)['Idempotency-Key']).toBe('uuid-1');
    expect(message).toMatch(/^Si cette adresse est valide/);
  });
});

describe('client API : gestion des erreurs', () => {
  const errorOf = async (response: Response): Promise<ApiError> => {
    const { req } = setup([response]);
    try {
      await req('GET', '/providers/x');
    } catch (e) {
      return e as ApiError;
    }
    throw new Error('aucune erreur levée');
  };

  it('422 → erreurs par champ', async () => {
    const e = await errorOf(
      jsonResponse(422, {
        message: 'Invalide.',
        errors: { email: ['Adresse invalide.'], password: ['Trop court.', 'Autre.'] },
      }),
    );
    expect(e).toBeInstanceOf(ApiError);
    expect(e.isValidation).toBe(true);
    expect(e.errors).toEqual({ email: ['Adresse invalide.'], password: ['Trop court.', 'Autre.'] });
  });

  it.each([
    [401, 'isUnauthenticated'],
    [403, 'isForbidden'],
    [404, 'isNotFound'],
  ] as const)('%i est reconnu', async (status, flag) => {
    const e = await errorOf(jsonResponse(status, { message: 'Message serveur.' }));
    expect(e.status).toBe(status);
    expect(e[flag]).toBe(true);
    expect(e.message).toBe('Message serveur.');
  });

  it('429 expose Retry-After', async () => {
    const e = await errorOf(
      jsonResponse(429, { message: 'Trop de requêtes.' }, { 'Retry-After': '42' }),
    );
    expect(e.isRateLimited).toBe(true);
    expect(e.retryAfter).toBe(42);
  });

  it('500 → message générique, jamais le détail du serveur', async () => {
    const e = await errorOf(
      jsonResponse(500, { message: 'SQLSTATE[23000] /var/www/app/Models/User.php' }),
    );
    expect(e.status).toBe(500);
    expect(e.message).not.toContain('SQLSTATE');
    expect(e.message).toBe('Une erreur est survenue. Réessayez dans quelques instants.');
  });

  it('erreur réseau → ApiError de statut 0', async () => {
    const req = createRequester({
      baseUrl: 'http://api.test',
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    await expect(req('GET', '/home')).rejects.toMatchObject({ status: 0 });
  });

  it('getUser renvoie null sur 401', async () => {
    const { api } = setup([jsonResponse(401, { message: 'Non authentifié.' })]);
    await expect(api.getUser()).resolves.toBeNull();
  });
});

describe('construction des requêtes', () => {
  it('sérialise filtres, tableaux (virgules) et ignore les valeurs vides', () => {
    expect(
      buildQueryString({
        'filter[q]': 'garde',
        'filter[service]': ['a', 'b'],
        page: 2,
        sort: undefined,
        lat: null,
        x: '',
      }),
    ).toBe('?filter%5Bq%5D=garde&filter%5Bservice%5D=a%2Cb&page=2');
    expect(buildQueryString({})).toBe('');
  });

  it('listProviders utilise les clés du contrat (filter[...], sort, per_page)', async () => {
    const { api, calls } = setup([
      jsonResponse(200, {
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
        links: { next: null, prev: null },
      }),
    ]);
    await api.listProviders({
      q: 'x',
      city: 'abidjan',
      service: ['gardiennage-arme', 'brigade-canine'],
      sort: '-rating',
      lat: 5.3,
      lng: -4,
      page: 2,
      per_page: 12,
    });
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/providers');
    expect(url.searchParams.get('filter[q]')).toBe('x');
    expect(url.searchParams.get('filter[city]')).toBe('abidjan');
    expect(url.searchParams.get('filter[service]')).toBe('gardiennage-arme,brigade-canine');
    expect(url.searchParams.get('sort')).toBe('-rating');
    expect(url.searchParams.get('lat')).toBe('5.3');
    expect(url.searchParams.get('per_page')).toBe('12');
  });
});

describe('vérification e-mail et code d’erreur', () => {
  it('resendVerificationPublic envoie uniquement l’e-mail à /auth/verification/resend', async () => {
    const { api, calls } = setup([jsonResponse(204), jsonResponse(202, { message: 'Neutre.' })]);
    await expect(api.resendVerificationPublic('a@b.co')).resolves.toBe('Neutre.');
    expect(calls[1]!.url).toBe('http://api.test/api/v1/auth/verification/resend');
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ email: 'a@b.co' });
  });

  it('expose le code du corps d’erreur (403 email_unverified)', async () => {
    const { api } = setup([
      jsonResponse(204),
      jsonResponse(403, { message: 'Confirmez.', code: 'email_unverified' }),
    ]);
    await expect(api.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      status: 403,
      code: 'email_unverified',
    });
  });

  it('code null pour un 403 sans code', async () => {
    const { api } = setup([jsonResponse(204), jsonResponse(403, { message: 'Interdit.' })]);
    await expect(api.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      status: 403,
      code: null,
    });
  });
});
