// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequester } from '@/lib/api/http';

describe('client API serveur : secret de rendu serveur', () => {
  it('ajoute les en-têtes serveur à chaque appel côté serveur', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const req = createRequester({
      baseUrl: 'https://api.test',
      fetchImpl,
      getCookieHeader: async () => null,
      serverHeaders: () => ({ 'X-SSR-Secret': 'valeur-de-test' }),
    });
    await req('GET', '/providers');
    const init = vi.mocked(fetchImpl).mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-SSR-Secret']).toBe('valeur-de-test');
  });

  it('n’ajoute aucun en-tête secret quand aucune variable n’est fournie', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const req = createRequester({ baseUrl: 'https://api.test', fetchImpl, getCookieHeader: async () => null });
    await req('GET', '/providers');
    const init = vi.mocked(fetchImpl).mock.calls[0]![1] as RequestInit;
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('X-SSR-Secret');
  });
});
