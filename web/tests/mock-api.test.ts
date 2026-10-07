import { describe, expect, it } from 'vitest';
import { mockApi, haversineMeters } from '@/lib/mocks/mock-api';
import { stateForces } from '@/lib/mocks/forces';
import { providers } from '@/lib/mocks/providers';
import { referenceData } from '@/lib/mocks/reference';

describe('fixtures et API simulée', () => {
  it('fournit au moins 12 prestataires, 8 forces et des référentiels complets', () => {
    expect(providers.length).toBeGreaterThanOrEqual(12);
    expect(stateForces.length).toBeGreaterThanOrEqual(8);
    expect(referenceData.service_types.length).toBeGreaterThanOrEqual(25);
    expect(
      referenceData.cities.find((c) => c.slug === 'abidjan')!.districts.length,
    ).toBeGreaterThanOrEqual(12);
    expect(new Set(providers.map((p) => p.slug)).size).toBe(providers.length);
  });

  it('filtre, trie et pagine', async () => {
    const all = await mockApi.listProviders({ per_page: 5 });
    expect(all.data).toHaveLength(5);
    expect(all.meta).toMatchObject({ current_page: 1, per_page: 5, total: providers.length });
    const byService = await mockApi.listProviders({ service: ['brigade-canine'] });
    expect(byService.data.every((p) => p.services.some((s) => s.slug === 'brigade-canine'))).toBe(
      true,
    );
    const byName = await mockApi.listProviders({ sort: 'name', per_page: 50 });
    const names = byName.data.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
    const tolerant = await mockApi.listProviders({ q: 'securite sentinelle' });
    expect(tolerant.data[0]?.slug).toBe('sentinelle-securite-abidjan');
  });

  it('calcule la distance et trie du plus proche', async () => {
    const res = await mockApi.listStateForces({ lat: 5.3225, lng: -4.0195, sort: 'distance' });
    expect(res.data[0]!.slug).toBe('commissariat-du-plateau');
    expect(res.data[0]!.distance_m).toBeLessThan(100);
    const d = res.data.map((f) => f.distance_m!);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(haversineMeters(5.3, -4, 5.3, -4)).toBe(0);
  });

  it('refuse le tri par distance sans position (422) et renvoie 404 sur slug inconnu', async () => {
    await expect(mockApi.listProviders({ sort: 'distance' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(mockApi.getProvider('inconnu')).rejects.toMatchObject({ status: 404 });
  });

  it('marqueurs : limités à la bbox', async () => {
    const markers = await mockApi.getMapMarkers({
      kind: 'providers',
      filters: {},
      bbox: '-5.5,7.0,-4.5,8.0',
    });
    expect(markers.map((m) => m.slug)).toEqual(['flamme-securite-incendie']);
  });

  it('géocode un quartier', async () => {
    const res = await mockApi.geocode('riviera');
    expect(res[0]?.label).toContain('Riviera Palmeraie');
  });

  it('ne renvoie jamais d’e-mail dans les avis', async () => {
    const reviews = await mockApi.listProviderReviews('sentinelle-securite-abidjan');
    expect(JSON.stringify(reviews)).not.toMatch(/@/);
  });
});

describe('inscription (flux anti-énumération)', () => {
  const input = {
    first_name: 'A',
    last_name: 'B',
    email: 'nouveau@example.test',
    password: 'motdepasse12',
    password_confirmation: 'motdepasse12',
    consent: true,
  };

  it('renvoie un message générique identique, même pour un e-mail « déjà pris »', async () => {
    const a = await mockApi.register(input);
    const b = await mockApi.register({ ...input, email: 'pris@example.test' });
    expect(a).toBe(b);
    expect(a).toMatch(/^Si cette adresse est valide/);
  });

  it('ouvre aucune session et refuse la connexion tant que le lien n’est pas cliqué', async () => {
    await mockApi.register(input);
    await expect(mockApi.getUser()).resolves.toBeNull();
    await expect(
      mockApi.login({ email: input.email, password: input.password }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('valide toujours le consentement (422)', async () => {
    await expect(mockApi.register({ ...input, consent: false })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('renvoi public : même réponse neutre pour tout e-mail ; 403 avec code email_unverified', async () => {
    const a = await mockApi.resendVerificationPublic('x@example.test');
    const b = await mockApi.resendVerificationPublic('inconnu@example.test');
    expect(a).toBe(b);
    await mockApi.register(input);
    await expect(
      mockApi.login({ email: input.email, password: input.password }),
    ).rejects.toMatchObject({ status: 403, code: 'email_unverified' });
  });
});
