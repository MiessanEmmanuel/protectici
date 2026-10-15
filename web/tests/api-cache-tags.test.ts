// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cacheTagsFor, createRequester } from '@/lib/api/http';
import { lazyMockApi } from '@/lib/mocks/lazy-mock-api';

type NextInit = RequestInit & { next?: { revalidate: number; tags?: string[] } };

function setup(cookie: string | null) {
  const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
  const req = createRequester({ baseUrl: 'http://api.test', fetchImpl, getCookieHeader: async () => cookie });
  const init = () => vi.mocked(fetchImpl).mock.calls[0]![1] as NextInit;
  return { req, init };
}

describe('étiquettes du cache de données', () => {
  it('déduit l’espace de cache du premier segment du chemin', () => {
    expect(cacheTagsFor('/providers/abc/reviews')).toEqual(['directory', 'providers']);
    expect(cacheTagsFor('/state-forces?x=1')).toEqual(['directory', 'state-forces']);
    expect(cacheTagsFor('/blog/posts')).toEqual(['blog']);
    expect(cacheTagsFor('/pages/cgu')).toEqual(['site', 'pages']);
    expect(cacheTagsFor('/auth/user')).toEqual([]);
  });

  it('met en cache une lecture publique anonyme avec revalidation et étiquettes', async () => {
    const { req, init } = setup(null);
    await req('GET', '/providers', { revalidate: 60 });
    expect(init().next).toEqual({ revalidate: 60, tags: ['directory', 'providers'] });
    expect(init().cache).toBeUndefined();
  });

  it('ne met jamais en cache une requête portant le cookie de session', async () => {
    const { req, init } = setup('protectici_session=abc');
    await req('GET', '/providers');
    expect(init().cache).toBe('no-store');
    expect(init().next).toBeUndefined();
  });

  it('ne met pas en cache les écritures', async () => {
    const { req, init } = setup(null);
    await req('POST', '/newsletter/subscribe', { body: {} });
    expect(init().next).toBeUndefined();
  });
});

describe('API factice chargée à la demande', () => {
  it('délègue chaque appel au module de démonstration, sans être thenable', async () => {
    expect((lazyMockApi as unknown as { then?: unknown }).then).toBeUndefined();
    const data = await lazyMockApi.getReferenceData();
    expect(data.cities.length).toBeGreaterThan(0);
  });
});
