import { ApiError } from './errors';
import type { Query, Requester } from './http';
import type {
  GeocodeResult,
  HomeData,
  LoginResult,
  MapMarker,
  MarkerQuery,
  Paginated,
  ProviderDetail,
  ProviderQuery,
  ProviderSummary,
  ReferenceData,
  Review,
  StateForceDetail,
  StateForceQuery,
  StateForceSummary,
  TwoFactorEnable,
  User,
} from './types';

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  consent: boolean;
  turnstile_token?: string;
}

/** Surface de l'API utilisée par l'application (réelle ou mock). */
export interface Api {
  // Authentification
  register(input: RegisterInput, idempotencyKey?: string): Promise<User>;
  login(input: { email: string; password: string; remember?: boolean }): Promise<LoginResult>;
  twoFactorChallenge(input: { code?: string; recovery_code?: string }): Promise<User>;
  logout(): Promise<void>;
  getUser(): Promise<User | null>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(input: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<void>;
  resendVerification(): Promise<void>;
  enableTwoFactor(): Promise<TwoFactorEnable>;
  confirmTwoFactor(code: string): Promise<string[]>;
  disableTwoFactor(password: string): Promise<void>;
  updateProfile(input: {
    first_name?: string;
    last_name?: string;
    phone?: string | null;
  }): Promise<User>;
  changePassword(input: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<void>;
  // Annuaire
  getReferenceData(): Promise<ReferenceData>;
  getHome(): Promise<HomeData>;
  listProviders(query?: ProviderQuery): Promise<Paginated<ProviderSummary>>;
  getPopularProviders(limit?: number): Promise<ProviderSummary[]>;
  getProvider(slug: string): Promise<ProviderDetail>;
  trackProviderView(slug: string): Promise<void>;
  listProviderReviews(slug: string, page?: number, perPage?: number): Promise<Paginated<Review>>;
  listStateForces(query?: StateForceQuery): Promise<Paginated<StateForceSummary>>;
  getStateForce(slug: string): Promise<StateForceDetail>;
  getMapMarkers(query: MarkerQuery): Promise<MapMarker[]>;
  geocode(q: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
  listFavorites(page?: number): Promise<Paginated<ProviderSummary>>;
  addFavorite(slug: string): Promise<void>;
  removeFavorite(slug: string): Promise<void>;
}

function geoQuery(q: { lat?: number; lng?: number; radius_km?: number }): Query {
  return { lat: q.lat, lng: q.lng, radius_km: q.radius_km };
}

export function providerQueryToParams(q: ProviderQuery = {}): Query {
  return {
    'filter[q]': q.q,
    'filter[city]': q.city,
    'filter[district]': q.district,
    'filter[service]': q.service,
    'filter[company_type]': q.company_type,
    ...geoQuery(q),
    sort: q.sort,
    page: q.page,
    per_page: q.per_page,
  };
}

export function stateForceQueryToParams(q: StateForceQuery = {}): Query {
  return {
    'filter[q]': q.q,
    'filter[city]': q.city,
    'filter[district]': q.district,
    'filter[type]': q.type,
    'filter[procedure]': q.procedure,
    ...geoQuery(q),
    sort: q.sort,
    page: q.page,
    per_page: q.per_page,
  };
}

export function markerQueryToParams(q: MarkerQuery): Query {
  const base =
    q.kind === 'providers' ? providerQueryToParams(q.filters) : stateForceQueryToParams(q.filters);
  return { ...base, type: q.kind, bbox: q.bbox };
}

const enc = encodeURIComponent;

export function buildApi(req: Requester): Api {
  return {
    async register(input, idempotencyKey) {
      const res = await req<{ data: User }>('POST', '/auth/register', {
        body: input,
        idempotencyKey,
      });
      return res.data;
    },
    async login(input) {
      const res = await req<{ data?: User; two_factor?: boolean }>('POST', '/auth/login', {
        body: input,
      });
      if (res.two_factor) return { kind: 'two_factor' };
      if (!res.data) throw new Error('Réponse de connexion inattendue');
      return { kind: 'user', user: res.data };
    },
    async twoFactorChallenge(input) {
      const res = await req<{ data: User }>('POST', '/auth/two-factor-challenge', { body: input });
      return res.data;
    },
    async logout() {
      await req('POST', '/auth/logout');
    },
    async getUser() {
      try {
        const res = await req<{ data: User }>('GET', '/auth/user');
        return res.data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    async forgotPassword(email) {
      await req('POST', '/auth/forgot-password', { body: { email } });
    },
    async resetPassword(input) {
      await req('POST', '/auth/reset-password', { body: input });
    },
    async resendVerification() {
      await req('POST', '/auth/email/resend');
    },
    async enableTwoFactor() {
      return req<TwoFactorEnable>('POST', '/auth/two-factor/enable');
    },
    async confirmTwoFactor(code) {
      const res = await req<{ recovery_codes: string[] }>('POST', '/auth/two-factor/confirm', {
        body: { code },
      });
      return res.recovery_codes;
    },
    async disableTwoFactor(password) {
      await req('POST', '/auth/two-factor/disable', { body: { password } });
    },
    async updateProfile(input) {
      const res = await req<{ data: User }>('PATCH', '/auth/profile', { body: input });
      return res.data;
    },
    async changePassword(input) {
      await req('PUT', '/auth/password', { body: input });
    },
    async getReferenceData() {
      const res = await req<{ data: ReferenceData }>('GET', '/reference-data', { revalidate: 300 });
      return res.data;
    },
    async getHome() {
      const res = await req<{ data: HomeData }>('GET', '/home', { revalidate: 120 });
      return res.data;
    },
    listProviders(query) {
      return req<Paginated<ProviderSummary>>('GET', '/providers', {
        query: providerQueryToParams(query),
      });
    },
    async getPopularProviders(limit = 8) {
      const res = await req<{ data: ProviderSummary[] }>('GET', '/providers/popular', {
        query: { limit },
        revalidate: 120,
      });
      return res.data;
    },
    async getProvider(slug) {
      const res = await req<{ data: ProviderDetail }>('GET', `/providers/${enc(slug)}`);
      return res.data;
    },
    async trackProviderView(slug) {
      await req('POST', `/providers/${enc(slug)}/view`);
    },
    listProviderReviews(slug, page, perPage) {
      return req<Paginated<Review>>('GET', `/providers/${enc(slug)}/reviews`, {
        query: { page, per_page: perPage },
      });
    },
    listStateForces(query) {
      return req<Paginated<StateForceSummary>>('GET', '/state-forces', {
        query: stateForceQueryToParams(query),
      });
    },
    async getStateForce(slug) {
      const res = await req<{ data: StateForceDetail }>('GET', `/state-forces/${enc(slug)}`);
      return res.data;
    },
    async getMapMarkers(query) {
      const res = await req<{ data: MapMarker[] }>('GET', '/map/markers', {
        query: markerQueryToParams(query),
      });
      return res.data;
    },
    async geocode(q, signal) {
      const res = await req<{ data: GeocodeResult[] }>('GET', '/geocode', { query: { q }, signal });
      return res.data;
    },
    listFavorites(page) {
      return req<Paginated<ProviderSummary>>('GET', '/me/favorites', { query: { page } });
    },
    async addFavorite(slug) {
      await req('PUT', `/providers/${enc(slug)}/favorite`);
    },
    async removeFavorite(slug) {
      await req('DELETE', `/providers/${enc(slug)}/favorite`);
    },
  };
}
