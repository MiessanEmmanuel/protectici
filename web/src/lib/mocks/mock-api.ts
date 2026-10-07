import { ApiError } from '../api/errors';
import type { Api, RegisterInput } from '../api/endpoints';
import type {
  GeocodeResult,
  MapMarker,
  Paginated,
  ProviderQuery,
  ProviderSummary,
  Review,
  Role,
  StateForceQuery,
  StateForceSummary,
  User,
} from '../api/types';
import { stateForces } from './forces';
import { providers, reviewsBySlug } from './providers';
import { cities, referenceData } from './reference';

/**
 * Implémentation locale de l'API (NEXT_PUBLIC_USE_MOCKS=1). Reproduit les formes du contrat.
 * Session simulée dans un cookie `mock_state` NON sensible (aucun jeton, jamais en production).
 * Comptes simulés : e-mail commençant par « admin » => rôle admin + 2FA (code 123456) ;
 * « editor » => rôle editor ; sinon rôle user. Mot de passe : 8 caractères minimum.
 */

const MOCK_COOKIE = 'mock_state';
const MOCK_2FA_CODE = '123456';

interface MockState {
  e: string;
  f: string;
  l: string;
  r: Role;
  tf: boolean;
  v: boolean;
  fav: string[];
}

let pending2fa: MockState | null = null;

const isBrowser = () => typeof document !== 'undefined';
const delay = (ms = 120) =>
  isBrowser() ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

function readState(): MockState | null {
  if (!isBrowser()) return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${MOCK_COOKIE}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(MOCK_COOKIE.length + 1))) as MockState;
  } catch {
    return null;
  }
}
function writeState(state: MockState | null): void {
  if (!isBrowser()) return;
  const value = state ? encodeURIComponent(JSON.stringify(state)) : '';
  document.cookie = `${MOCK_COOKIE}=${value}; path=/; SameSite=Lax${state ? '' : '; max-age=0'}`;
}
function toUser(s: MockState): User {
  return {
    id: 1,
    first_name: s.f,
    last_name: s.l,
    email: s.e,
    phone: null,
    role: s.r,
    email_verified: s.v,
    two_factor_enabled: s.tf,
    created_at: '2026-10-01T09:00:00Z',
  };
}
function requireState(): MockState {
  const s = readState();
  if (!s) throw new ApiError(401, 'Vous devez être connecté pour effectuer cette action.');
  return s;
}
function fail(field: string, message: string): never {
  throw new ApiError(422, 'Certaines informations sont invalides.', { [field]: [message] });
}

/* ---------- Utilitaires de recherche ---------- */

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}

function paginate<T>(items: T[], page = 1, perPage = 12): Paginated<T> {
  const per = Math.min(Math.max(perPage, 1), 50);
  const last = Math.max(1, Math.ceil(items.length / per));
  const current = Math.min(Math.max(page, 1), last);
  return {
    data: items.slice((current - 1) * per, current * per),
    meta: { current_page: current, last_page: last, per_page: per, total: items.length },
    links: {
      next: current < last ? `?page=${current + 1}` : null,
      prev: current > 1 ? `?page=${current - 1}` : null,
    },
  };
}

function matchesQuery(q: string | undefined, haystacks: string[]): boolean {
  if (!q) return true;
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const text = normalize(haystacks.join(' '));
  return words.every((w) => text.includes(w) || (w.length > 4 && text.includes(w.slice(0, -1))));
}

function withDistance<
  T extends { lat: number | null; lng: number | null; distance_m: number | null },
>(item: T, lat?: number, lng?: number): T {
  if (lat === undefined || lng === undefined || item.lat === null || item.lng === null) {
    return { ...item, distance_m: null };
  }
  return { ...item, distance_m: haversineMeters(lat, lng, item.lat, item.lng) };
}

function toSummary(p: (typeof providers)[number]): ProviderSummary {
  return {
    slug: p.slug,
    name: p.name,
    logo_url: p.logo_url,
    city: p.city,
    district: p.district,
    phone: p.phone,
    services: p.services,
    price_from: p.price_from,
    rating_avg: p.rating_avg,
    rating_count: p.rating_count,
    is_verified: p.is_verified,
    is_featured: p.is_featured,
    lat: p.lat,
    lng: p.lng,
    distance_m: null,
  };
}

function filterProviders(q: ProviderQuery): ProviderSummary[] {
  const hasGeo = q.lat !== undefined && q.lng !== undefined;
  const radius = Math.min(q.radius_km ?? 50, 50) * 1000;
  let list = providers
    .filter((p) =>
      matchesQuery(q.q, [
        p.name,
        ...p.services.map((s) => s.name),
        p.city.name,
        p.district?.name ?? '',
      ]),
    )
    .filter((p) => !q.city || p.city.slug === q.city)
    .filter((p) => !q.district || p.district?.slug === q.district)
    .filter(
      (p) => !q.service?.length || q.service.some((s) => p.services.some((ps) => ps.slug === s)),
    )
    .filter(
      (p) =>
        !q.company_type?.length ||
        q.company_type.some((t) => p.company_types.some((c) => c.slug === t)),
    )
    .map((p) => withDistance(toSummary(p), q.lat, q.lng));
  if (hasGeo && q.radius_km !== undefined)
    list = list.filter((p) => p.distance_m !== null && p.distance_m <= radius);
  const views = new Map(providers.map((p) => [p.slug, p.views_count]));
  switch (q.sort) {
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      break;
    case '-rating':
      list.sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);
      break;
    case 'distance':
      if (!hasGeo) fail('sort', 'Le tri par distance exige une position.');
      list.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
      break;
    case '-popular':
    default:
      list.sort(
        (a, b) =>
          Number(b.is_featured) - Number(a.is_featured) ||
          (views.get(b.slug) ?? 0) - (views.get(a.slug) ?? 0),
      );
  }
  return list;
}

function filterForces(q: StateForceQuery): StateForceSummary[] {
  const hasGeo = q.lat !== undefined && q.lng !== undefined;
  const radius = Math.min(q.radius_km ?? 50, 50) * 1000;
  let list = stateForces
    .filter((f) =>
      matchesQuery(q.q, [f.name, f.force_type.name, f.city.name, f.district?.name ?? '']),
    )
    .filter((f) => !q.city || f.city.slug === q.city)
    .filter((f) => !q.district || f.district?.slug === q.district)
    .filter((f) => !q.type?.length || q.type.includes(f.force_type.slug))
    .filter(
      (f) =>
        !q.procedure?.length || q.procedure.some((p) => f.procedures.some((fp) => fp.slug === p)),
    )
    .map((f) => {
      const summary: StateForceSummary = {
        slug: f.slug,
        name: f.name,
        force_type: f.force_type,
        phone: f.phone,
        emergency_phone: f.emergency_phone,
        city: f.city,
        district: f.district,
        address: f.address,
        is_open_24h: f.is_open_24h,
        lat: f.lat,
        lng: f.lng,
        distance_m: null,
      };
      return withDistance(summary, q.lat, q.lng);
    });
  if (hasGeo && q.radius_km !== undefined)
    list = list.filter((f) => f.distance_m !== null && f.distance_m <= radius);
  if (q.sort === 'distance') {
    if (!hasGeo) fail('sort', 'Le tri par distance exige une position.');
    list.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  return list;
}

function inBbox(lat: number, lng: number, bbox?: string): boolean {
  if (!bbox) return true;
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  if ([minLng, minLat, maxLng, maxLat].some((n) => n === undefined || Number.isNaN(n))) return true;
  return lng >= minLng! && lng <= maxLng! && lat >= minLat! && lat <= maxLat!;
}

function geocodeLocal(q: string): GeocodeResult[] {
  const n = normalize(q);
  const out: GeocodeResult[] = [];
  for (const city of cities) {
    if (city.lat !== null && city.lng !== null && normalize(city.name).includes(n)) {
      out.push({ label: `${city.name}, Côte d'Ivoire`, lat: city.lat, lng: city.lng });
    }
    for (const d of city.districts) {
      const match = providers.find((p) => p.district?.slug === d.slug && p.lat !== null);
      const force = stateForces.find((f) => f.district?.slug === d.slug);
      const point = match ?? force;
      if (point && point.lat !== null && point.lng !== null && normalize(d.name).includes(n)) {
        out.push({ label: `${d.name}, ${city.name}`, lat: point.lat, lng: point.lng });
      }
    }
  }
  return out.slice(0, 6);
}

/* ---------- API simulée ---------- */

export const mockApi: Api = {
  async register(input: RegisterInput) {
    await delay();
    if (!input.consent) fail('consent', 'Vous devez accepter les conditions pour créer un compte.');
    if (input.password !== input.password_confirmation)
      fail('password', 'La confirmation ne correspond pas.');
    if (input.password.length < 10)
      fail('password', 'Le mot de passe doit contenir au moins 10 caractères.');
    if (normalize(input.email) === 'pris@example.test')
      fail('email', 'Cette adresse e-mail est déjà utilisée.');
    const state: MockState = {
      e: input.email,
      f: input.first_name,
      l: input.last_name,
      r: 'user',
      tf: false,
      v: false,
      fav: [],
    };
    writeState(state);
    return toUser(state);
  },
  async login({ email, password }) {
    await delay();
    if (password.length < 8)
      throw new ApiError(422, 'Ces identifiants ne correspondent à aucun compte.', {
        email: ['Ces identifiants ne correspondent à aucun compte.'],
      });
    const lower = normalize(email);
    const role: Role = lower.startsWith('admin')
      ? 'admin'
      : lower.startsWith('editor')
        ? 'editor'
        : 'user';
    const existing = readState();
    const state: MockState = {
      e: email,
      f:
        role === 'user'
          ? existing?.e === email
            ? existing.f
            : 'Awa'
          : role === 'admin'
            ? 'Admin'
            : 'Éditeur',
      l: role === 'user' ? (existing?.e === email ? existing.l : 'Koné') : 'Démo',
      r: role,
      tf: role !== 'user',
      v: true,
      fav: existing?.e === email ? existing.fav : [],
    };
    if (state.tf) {
      pending2fa = state;
      return { kind: 'two_factor' };
    }
    writeState(state);
    return { kind: 'user', user: toUser(state) };
  },
  async twoFactorChallenge({ code, recovery_code }) {
    await delay();
    if (!pending2fa) throw new ApiError(401, 'Votre session a expiré. Reconnectez-vous.');
    if (code !== MOCK_2FA_CODE && !recovery_code) fail('code', 'Le code est invalide ou expiré.');
    const state = pending2fa;
    pending2fa = null;
    writeState(state);
    return toUser(state);
  },
  async logout() {
    await delay(50);
    writeState(null);
  },
  async getUser() {
    const s = readState();
    return s ? toUser(s) : null;
  },
  async forgotPassword() {
    await delay();
  },
  async resetPassword(input) {
    await delay();
    if (input.password !== input.password_confirmation)
      fail('password', 'La confirmation ne correspond pas.');
    if (input.token === 'expire')
      throw new ApiError(422, 'Ce lien de réinitialisation est invalide ou expiré.', {
        token: ['Ce lien de réinitialisation est invalide ou expiré.'],
      });
  },
  async resendVerification() {
    const s = requireState();
    await delay();
    writeState({ ...s, v: true }); // simule le clic sur le lien reçu par e-mail
  },
  async enableTwoFactor() {
    requireState();
    await delay();
    return {
      secret: 'JBSWY3DPEHPK3PXP',
      qr_svg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="200" height="200"><rect width="8" height="8" fill="#fff"/><path fill="#001029" d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 5h2v1H6zM5 7h2v1H5zM3 3h1v1H3z"/></svg>',
    };
  },
  async confirmTwoFactor(code) {
    const s = requireState();
    await delay();
    if (code !== MOCK_2FA_CODE) fail('code', 'Le code est invalide ou expiré.');
    writeState({ ...s, tf: true });
    return [
      'AAAA-1111',
      'BBBB-2222',
      'CCCC-3333',
      'DDDD-4444',
      'EEEE-5555',
      'FFFF-6666',
      'GGGG-7777',
      'HHHH-8888',
    ];
  },
  async disableTwoFactor(password) {
    const s = requireState();
    await delay();
    if (password.length < 8) fail('password', 'Mot de passe incorrect.');
    writeState({ ...s, tf: false });
  },
  async updateProfile(input) {
    const s = requireState();
    await delay();
    const next = { ...s, f: input.first_name ?? s.f, l: input.last_name ?? s.l };
    writeState(next);
    return { ...toUser(next), phone: input.phone ?? null };
  },
  async changePassword(input) {
    requireState();
    await delay();
    if (input.current_password.length < 8)
      fail('current_password', 'Le mot de passe actuel est incorrect.');
    if (input.password !== input.password_confirmation)
      fail('password', 'La confirmation ne correspond pas.');
  },
  async getReferenceData() {
    return referenceData;
  },
  async getHome() {
    return {
      stats: {
        providers: providers.length,
        state_forces: stateForces.length,
        service_types: referenceData.service_types.length,
      },
      popular_providers: filterProviders({ sort: '-popular' }).slice(0, 8),
    };
  },
  async listProviders(query = {}) {
    await delay(60);
    return paginate(filterProviders(query), query.page, query.per_page);
  },
  async getPopularProviders(limit = 8) {
    return filterProviders({ sort: '-popular' }).slice(0, Math.min(limit, 20));
  },
  async getProvider(slug) {
    const p = providers.find((x) => x.slug === slug);
    if (!p) throw new ApiError(404, 'Cette page ou cette ressource est introuvable.');
    const state = readState();
    return { ...p, is_favorite: state ? state.fav.includes(slug) : null };
  },
  async trackProviderView() {},
  async listProviderReviews(slug, page, perPage) {
    if (!providers.some((p) => p.slug === slug))
      throw new ApiError(404, 'Cette page ou cette ressource est introuvable.');
    const reviews: Review[] = reviewsBySlug[slug] ?? [];
    return paginate(reviews, page, perPage ?? 5);
  },
  async listStateForces(query = {}) {
    await delay(60);
    return paginate(filterForces(query), query.page, query.per_page);
  },
  async getStateForce(slug) {
    const f = stateForces.find((x) => x.slug === slug);
    if (!f) throw new ApiError(404, 'Cette page ou cette ressource est introuvable.');
    return f;
  },
  async getMapMarkers(query): Promise<MapMarker[]> {
    await delay(60);
    const items =
      query.kind === 'providers' ? filterProviders(query.filters) : filterForces(query.filters);
    return items
      .filter((i) => i.lat !== null && i.lng !== null && inBbox(i.lat, i.lng, query.bbox))
      .map((i) => ({ slug: i.slug, name: i.name, lat: i.lat as number, lng: i.lng as number }))
      .slice(0, 500);
  },
  async geocode(q) {
    await delay(150);
    if (q.trim().length < 3) fail('q', 'Saisissez au moins 3 caractères.');
    return geocodeLocal(q);
  },
  async listFavorites(page) {
    const s = requireState();
    const favs = filterProviders({ sort: 'name' }).filter((p) => s.fav.includes(p.slug));
    return paginate(favs, page);
  },
  async addFavorite(slug) {
    const s = requireState();
    if (!s.v) throw new ApiError(403, 'Vérifiez votre adresse e-mail avant d’ajouter un favori.');
    if (!providers.some((p) => p.slug === slug))
      throw new ApiError(404, 'Cette page ou cette ressource est introuvable.');
    writeState({ ...s, fav: Array.from(new Set([...s.fav, slug])) });
  },
  async removeFavorite(slug) {
    const s = requireState();
    writeState({ ...s, fav: s.fav.filter((f) => f !== slug) });
  },
};
