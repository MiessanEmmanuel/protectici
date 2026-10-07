import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/csp';
import { clusterPoints } from '@/lib/cluster';
import { formatDistance, formatFcfa, formatPhone } from '@/lib/format';
import { safeRedirect } from '@/lib/safe-redirect';
import { buildHref, parseProviderParams } from '@/lib/search-params';

describe('safeRedirect (anti open-redirect)', () => {
  it.each([
    ['/compte', '/compte'],
    ['/annuaire?q=a&page=2', '/annuaire?q=a&page=2'],
    ['https://evil.test', '/compte'],
    ['//evil.test', '/compte'],
    ['/\\evil.test', '/compte'],
    ['javascript:alert(1)', '/compte'],
    ['/ok\nSet-Cookie: x=1', '/compte'],
    ['', '/compte'],
    [undefined, '/compte'],
    ['evil', '/compte'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input as string | undefined)).toBe(expected);
  });
});

describe('CSP', () => {
  const prod = buildCsp({ nonce: 'abc', isDev: false, apiOrigin: 'https://api.protectici.ci' });
  it('est stricte en production', () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).not.toContain('unsafe-inline');
    expect(prod).not.toContain('unsafe-eval');
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
  });
  it('autorise tuiles OSM et API', () => {
    expect(prod).toContain('https://tile.openstreetmap.org');
    expect(prod).toContain("connect-src 'self' https://api.protectici.ci");
  });
  it('relâche uniquement en développement', () => {
    const dev = buildCsp({ nonce: 'abc', isDev: true, apiOrigin: 'http://localhost:8000' });
    expect(dev).toContain("'unsafe-eval'");
  });
});

describe('search-params', () => {
  it('analyse et borne les paramètres', () => {
    const { query, view } = parseProviderParams({
      q: ' garde ',
      city: 'abidjan',
      service: 'gardiennage-arme,brigade-canine',
      sort: 'distance', // sans position => ignoré
      page: '3',
      view: 'map',
    });
    expect(query.q).toBe('garde');
    expect(query.service).toEqual(['gardiennage-arme', 'brigade-canine']);
    expect(query.sort).toBeUndefined();
    expect(query.page).toBe(3);
    expect(view).toBe('map');
  });
  it('rejette slugs, coordonnées et tri invalides', () => {
    const { query } = parseProviderParams({
      city: "x'; DROP",
      lat: '999',
      lng: '1',
      sort: 'prix',
      page: '-1',
    });
    expect(query.city).toBeUndefined();
    expect(query.lat).toBeUndefined();
    expect(query.sort).toBeUndefined();
    expect(query.page).toBeUndefined();
  });
  it('construit des URL propres', () => {
    expect(
      buildHref('/annuaire', { q: '', city: 'abidjan', service: ['a', 'b'], page: undefined }),
    ).toBe('/annuaire?city=abidjan&service=a%2Cb');
    expect(buildHref('/annuaire', {})).toBe('/annuaire');
  });
});

describe('format et carte', () => {
  it('formate montants, distances, téléphones', () => {
    expect(formatFcfa(150000)).toBe('150 000 FCFA');
    expect(formatDistance(60)).toBe('60 m');
    expect(formatDistance(3720)).toBe('3,7 km');
    expect(formatDistance(null)).toBeNull();
    expect(formatPhone('+2252720000101')).toBe('+225 27 20 00 01 01');
  });
  it('regroupe les marqueurs proches et sépare les lointains', () => {
    const pts = [
      { slug: 'a', name: 'A', lat: 5.3, lng: -4.0 },
      { slug: 'b', name: 'B', lat: 5.301, lng: -4.001 },
      { slug: 'c', name: 'C', lat: 7.69, lng: -5.03 },
    ];
    const lowZoom = clusterPoints(pts, 8);
    expect(lowZoom.map((c) => c.count).sort()).toEqual([1, 2]);
    expect(clusterPoints(pts, 19)).toHaveLength(3);
  });
});
