import type { ProviderQuery, StateForceQuery } from './api/types';

/** L'URL est la source de vérité des filtres (annuaire et forces étatiques). */

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type ViewMode = 'list' | 'map';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function first(raw: RawSearchParams, key: string): string | undefined {
  const v = raw[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === '' ? undefined : s;
}

function text(raw: RawSearchParams, key: string): string | undefined {
  return first(raw, key)?.trim().slice(0, 100) || undefined;
}

function slug(raw: RawSearchParams, key: string): string | undefined {
  const v = first(raw, key);
  return v && SLUG.test(v) ? v : undefined;
}

function slugList(raw: RawSearchParams, key: string): string[] | undefined {
  const values = (
    Array.isArray(raw[key]) ? (raw[key] as string[]) : [raw[key] as string | undefined]
  )
    .flatMap((v) => (v ? v.split(',') : []))
    .map((v) => v.trim())
    .filter((v) => SLUG.test(v))
    .slice(0, 10);
  return values.length ? values : undefined;
}

function num(raw: RawSearchParams, key: string, min: number, max: number): number | undefined {
  const v = first(raw, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function page(raw: RawSearchParams): number | undefined {
  const n = num(raw, 'page', 1, 10000);
  return n ? Math.floor(n) : undefined;
}

function geo(raw: RawSearchParams) {
  const lat = num(raw, 'lat', -90, 90);
  const lng = num(raw, 'lng', -180, 180);
  if (lat === undefined || lng === undefined) return {};
  return { lat, lng, radius_km: num(raw, 'radius_km', 1, 50) };
}

const PROVIDER_SORTS = ['name', '-rating', '-popular', 'distance'] as const;
const FORCE_SORTS = ['name', 'distance'] as const;

export function parseProviderParams(raw: RawSearchParams): {
  query: ProviderQuery;
  view: ViewMode;
} {
  const g = geo(raw);
  const sortRaw = first(raw, 'sort');
  let sort = PROVIDER_SORTS.find((s) => s === sortRaw);
  if (sort === 'distance' && g.lat === undefined) sort = undefined;
  return {
    query: {
      q: text(raw, 'q'),
      city: slug(raw, 'city'),
      district: slug(raw, 'district'),
      service: slugList(raw, 'service'),
      company_type: slugList(raw, 'company_type'),
      ...g,
      sort,
      page: page(raw),
    },
    view: first(raw, 'view') === 'map' ? 'map' : 'list',
  };
}

export function parseForceParams(raw: RawSearchParams): { query: StateForceQuery; view: ViewMode } {
  const g = geo(raw);
  const sortRaw = first(raw, 'sort');
  let sort = FORCE_SORTS.find((s) => s === sortRaw);
  if (sort === 'distance' && g.lat === undefined) sort = undefined;
  return {
    query: {
      q: text(raw, 'q'),
      city: slug(raw, 'city'),
      district: slug(raw, 'district'),
      type: slugList(raw, 'type'),
      procedure: slugList(raw, 'procedure'),
      ...g,
      sort,
      page: page(raw),
    },
    view: first(raw, 'view') === 'map' ? 'map' : 'list',
  };
}

/** Construit une URL à partir de paramètres (valeurs vides ignorées, tableaux joints par virgule). */
export function buildHref(
  base: string,
  params: Record<string, string | number | string[] | undefined | null>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) usp.set(k, v.join(','));
    } else usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Paramètres d'URL à partir d'une requête analysée (pour liens de pagination, bascule vue). */
export function queryToUrlParams(
  query: ProviderQuery | StateForceQuery,
  view: ViewMode,
): Record<string, string | number | string[] | undefined> {
  const q = query as ProviderQuery & StateForceQuery;
  return {
    q: q.q,
    city: q.city,
    district: q.district,
    service: q.service,
    company_type: q.company_type,
    type: q.type,
    procedure: q.procedure,
    lat: q.lat,
    lng: q.lng,
    radius_km: q.radius_km,
    sort: q.sort,
    view: view === 'map' ? 'map' : undefined,
  };
}
