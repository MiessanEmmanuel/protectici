import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { buildApi } from '@/lib/api/endpoints';
import { createRequester } from '@/lib/api/http';

function res(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const xsrf = { value: null as string | null };
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith('/sanctum/csrf-cookie')) xsrf.value = 'tok';
    const next = responses.shift();
    if (!next) throw new Error('plus de réponse');
    return next;
  }) as unknown as typeof fetch;
  const req = createRequester({ baseUrl: 'http://api.test', fetchImpl, readXsrfCookie: () => xsrf.value });
  return { api: buildApi(req), req, calls };
}

describe('client API vague A : multipart et CSRF', () => {
  it('envoie un upload en multipart avec CSRF, sans Content-Type forcé', async () => {
    const { api, calls } = setup([
      res(204),
      res(201, { data: { id: 1, type: 'other', original_name: 'a.pdf', size_bytes: 3, uploaded_at: 'x', verified_at: null } }),
    ]);
    const file = new File(['abc'], 'a.pdf', { type: 'application/pdf' });
    await api.uploadDocument('provider', 'mon-slug', file, 'other');
    const call = calls[1]!;
    expect(call.url).toBe('http://api.test/api/v1/me/establishments/provider/mon-slug/documents');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['X-XSRF-TOKEN']).toBe('tok');
    expect(headers['Content-Type']).toBeUndefined();
    expect(call.init.credentials).toBe('include');
    const fd = call.init.body as FormData;
    expect(fd.get('type')).toBe('other');
    expect((fd.get('file') as File).name).toBe('a.pdf');
  });

  it('envoie alt et collection pour un média', async () => {
    const { api, calls } = setup([res(204), res(201, { data: { id: 2, collection: 'logo', url: 'u', alt: 'Logo' } })]);
    await api.uploadMedia('provider', 's', {
      file: new File(['x'], 'l.png', { type: 'image/png' }),
      collection: 'logo',
      alt: 'Logo',
    });
    const fd = calls[1]!.init.body as FormData;
    expect(fd.get('alt')).toBe('Logo');
    expect(fd.get('collection')).toBe('logo');
  });

  it('transmet Idempotency-Key à la création', async () => {
    const { api, calls } = setup([res(204), res(201, { data: { slug: 's' } })]);
    await api.createEstablishment(
      { type: 'state_force', force_type_id: 1, name: 'X', city_id: 1, consent: true },
      'uuid-9',
    );
    expect((calls[1]!.init.headers as Record<string, string>)['Idempotency-Key']).toBe('uuid-9');
  });

  it('télécharge un justificatif en Blob', async () => {
    const { api } = setup([new Response('contenu', { status: 200, headers: { 'Content-Type': 'application/pdf' } })]);
    const blob = await api.adminDownloadDocument(5);
    expect(await blob.text()).toBe('contenu');
  });

  it('envoie confirm_name dans le corps d’une suppression', async () => {
    const { api, calls } = setup([res(204), res(204)]);
    await api.adminDeleteEstablishment('provider', 3, 'Nom exact');
    expect(calls[1]!.init.method).toBe('DELETE');
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ confirm_name: 'Nom exact' });
  });
});

describe('client API vague A : erreurs', () => {
  const errorOf = async (response: Response) => {
    const { req } = setup([response]);
    try {
      await req('GET', '/x');
    } catch (e) {
      return e as ApiError;
    }
    throw new Error('aucune erreur');
  };

  it.each([409, 413, 415])('%i garde le message serveur et est exposé', async (status) => {
    const e = await errorOf(res(status, { message: 'Message précis.' }));
    expect(e.status).toBe(status);
    expect(e.message).toBe('Message précis.');
  });

  it('409 sans message → texte générique', async () => {
    const e = await errorOf(res(409, {}));
    expect(e.isConflict).toBe(true);
    expect(e.message).toMatch(/conflit/);
  });

  it('422 par champ', async () => {
    const e = await errorOf(res(422, { message: 'x', errors: { reason: ['Trop court.'] } }));
    expect(e.errors.reason).toEqual(['Trop court.']);
  });
});
