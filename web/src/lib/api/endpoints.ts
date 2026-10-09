import { ApiError } from './errors';
import type { Query, Requester } from './http';
import type {
  AdminAuditLog,
  AdminChangeRequestRow,
  AdminDashboard,
  AdminEstablishment,
  AdminEstablishmentQuery,
  AdminEstablishmentRow,
  AdminNotification,
  AdminReferenceInput,
  AdminReferenceItem,
  AdminUser,
  AdminUserQuery,
  AuditLogQuery,
  ChangeRequest,
  DocumentType,
  EstablishmentAction,
  EstablishmentCreateInput,
  EstablishmentDocument,
  EstablishmentMedia,
  EstablishmentType,
  GeocodeResult,
  MediaCollection,
  MyEstablishment,
  MyEstablishmentSummary,
  ReferenceResource,
  Role,
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
  /** 202 : message générique identique dans tous les cas (anti-énumération). Aucune session ouverte. */
  register(input: RegisterInput, idempotencyKey?: string): Promise<string>;
  /** 202 public, réponse identique dans tous les cas (aucun mot de passe renvoyé). */
  resendVerificationPublic(email: string): Promise<string>;
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

  // --- Vague A : inscription d'établissement et espace prestataire (contrat §7.2) ---
  createEstablishment(
    input: EstablishmentCreateInput,
    idempotencyKey: string,
  ): Promise<MyEstablishment>;
  listMyEstablishments(page?: number): Promise<Paginated<MyEstablishmentSummary>>;
  getMyEstablishment(type: EstablishmentType, slug: string): Promise<MyEstablishment>;
  updateMyEstablishment(
    type: EstablishmentType,
    slug: string,
    patch: Record<string, unknown>,
  ): Promise<MyEstablishment>;
  createChangeRequest(
    type: EstablishmentType,
    slug: string,
    changes: Record<string, unknown>,
  ): Promise<ChangeRequest>;
  cancelChangeRequest(type: EstablishmentType, slug: string, id: number): Promise<void>;
  uploadDocument(
    type: EstablishmentType,
    slug: string,
    file: File,
    docType: DocumentType,
  ): Promise<EstablishmentDocument>;
  deleteDocument(type: EstablishmentType, slug: string, id: number): Promise<void>;
  uploadMedia(
    type: EstablishmentType,
    slug: string,
    input: { file: File; collection: MediaCollection; alt: string },
  ): Promise<EstablishmentMedia>;
  deleteMedia(type: EstablishmentType, slug: string, id: number): Promise<void>;
  resubmitEstablishment(type: EstablishmentType, slug: string): Promise<void>;

  // --- Vague A : administration (contrat §7.3, rôle admin + 2FA) ---
  adminDashboard(): Promise<AdminDashboard>;
  adminListEstablishments(
    query?: AdminEstablishmentQuery,
  ): Promise<Paginated<AdminEstablishmentRow>>;
  adminGetEstablishment(type: EstablishmentType, id: number): Promise<AdminEstablishment>;
  adminUpdateEstablishment(
    type: EstablishmentType,
    id: number,
    patch: Record<string, unknown>,
  ): Promise<AdminEstablishment>;
  /** Idempotent côté API : rejouer ne change rien. `reason` requis pour reject/suspend. */
  adminEstablishmentAction(
    type: EstablishmentType,
    id: number,
    action: EstablishmentAction,
    reason?: string,
  ): Promise<void>;
  adminDeleteEstablishment(type: EstablishmentType, id: number, confirmName: string): Promise<void>;
  adminDownloadDocument(id: number): Promise<Blob>;
  adminListChangeRequests(query?: {
    status?: 'pending' | 'approved' | 'rejected';
    page?: number;
  }): Promise<Paginated<AdminChangeRequestRow>>;
  adminApproveChangeRequest(id: number): Promise<void>;
  adminRejectChangeRequest(id: number, reason: string): Promise<void>;
  adminListUsers(query?: AdminUserQuery): Promise<Paginated<AdminUser>>;
  adminUpdateUser(id: number, patch: { role?: Role; is_active?: boolean }): Promise<AdminUser>;
  adminAnonymizeUser(id: number, confirmEmail: string): Promise<void>;
  adminListReference(
    resource: ReferenceResource,
    page?: number,
  ): Promise<Paginated<AdminReferenceItem>>;
  adminCreateReference(
    resource: ReferenceResource,
    input: AdminReferenceInput,
  ): Promise<AdminReferenceItem>;
  adminUpdateReference(
    resource: ReferenceResource,
    id: number,
    input: AdminReferenceInput,
  ): Promise<AdminReferenceItem>;
  adminDeleteReference(resource: ReferenceResource, id: number): Promise<void>;
  adminListAuditLogs(query?: AuditLogQuery): Promise<Paginated<AdminAuditLog>>;
  adminListNotifications(): Promise<AdminNotification[]>;
  adminMarkNotificationRead(id: number | string): Promise<void>;
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

const mine = (type: EstablishmentType, slug: string) =>
  `/me/establishments/${enc(type)}/${enc(slug)}`;
const admin = (type: EstablishmentType, id: number) => `/admin/establishments/${enc(type)}/${id}`;

export const RESEND_NEUTRAL_MESSAGE =
  'Si cette adresse correspond à un compte non confirmé, un nouvel e-mail vient d’être envoyé.';

export const REGISTER_NEUTRAL_MESSAGE =
  'Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte.';

export function buildApi(req: Requester): Api {
  return {
    async register(input, idempotencyKey) {
      const res = await req<{ message?: string }>('POST', '/auth/register', {
        body: input,
        idempotencyKey,
      });
      return res?.message ?? REGISTER_NEUTRAL_MESSAGE;
    },
    async resendVerificationPublic(email) {
      const res = await req<{ message?: string }>('POST', '/auth/verification/resend', {
        body: { email },
      });
      return res?.message ?? RESEND_NEUTRAL_MESSAGE;
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

    async createEstablishment(input, idempotencyKey) {
      const res = await req<{ data: MyEstablishment }>('POST', '/establishments', {
        body: input,
        idempotencyKey,
      });
      return res.data;
    },
    listMyEstablishments(page) {
      return req<Paginated<MyEstablishmentSummary>>('GET', '/me/establishments', {
        query: { page },
      });
    },
    async getMyEstablishment(type, slug) {
      const res = await req<{ data: MyEstablishment }>('GET', mine(type, slug));
      return res.data;
    },
    async updateMyEstablishment(type, slug, patch) {
      const res = await req<{ data: MyEstablishment }>('PATCH', mine(type, slug), { body: patch });
      return res.data;
    },
    async createChangeRequest(type, slug, changes) {
      const res = await req<{ data: ChangeRequest }>('POST', `${mine(type, slug)}/change-requests`, {
        body: { changes },
      });
      return res.data;
    },
    async cancelChangeRequest(type, slug, id) {
      await req('DELETE', `${mine(type, slug)}/change-requests/${id}`);
    },
    async uploadDocument(type, slug, file, docType) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      const res = await req<{ data: EstablishmentDocument }>(
        'POST',
        `${mine(type, slug)}/documents`,
        { formData },
      );
      return res.data;
    },
    async deleteDocument(type, slug, id) {
      await req('DELETE', `${mine(type, slug)}/documents/${id}`);
    },
    async uploadMedia(type, slug, { file, collection, alt }) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collection', collection);
      formData.append('alt', alt);
      const res = await req<{ data: EstablishmentMedia }>('POST', `${mine(type, slug)}/media`, {
        formData,
      });
      return res.data;
    },
    async deleteMedia(type, slug, id) {
      await req('DELETE', `${mine(type, slug)}/media/${id}`);
    },
    async resubmitEstablishment(type, slug) {
      await req('POST', `${mine(type, slug)}/resubmit`);
    },

    async adminDashboard() {
      const res = await req<{ data: AdminDashboard }>('GET', '/admin/dashboard');
      return res.data;
    },
    adminListEstablishments(query = {}) {
      return req<Paginated<AdminEstablishmentRow>>('GET', '/admin/establishments', {
        query: {
          type: query.type,
          status: query.status,
          q: query.q,
          sort: query.sort,
          page: query.page,
          per_page: query.per_page,
        },
      });
    },
    async adminGetEstablishment(type, id) {
      const res = await req<{ data: AdminEstablishment }>('GET', admin(type, id));
      return res.data;
    },
    async adminUpdateEstablishment(type, id, patch) {
      const res = await req<{ data: AdminEstablishment }>('PATCH', admin(type, id), {
        body: patch,
      });
      return res.data;
    },
    async adminEstablishmentAction(type, id, action, reason) {
      await req('POST', `${admin(type, id)}/${action}`, {
        body: reason !== undefined ? { reason } : undefined,
      });
    },
    async adminDeleteEstablishment(type, id, confirmName) {
      await req('DELETE', admin(type, id), { body: { confirm_name: confirmName } });
    },
    adminDownloadDocument(id) {
      return req<Blob>('GET', `/admin/documents/${id}/download`, { responseType: 'blob' });
    },
    adminListChangeRequests(query = {}) {
      return req<Paginated<AdminChangeRequestRow>>('GET', '/admin/change-requests', {
        query: { status: query.status, page: query.page },
      });
    },
    async adminApproveChangeRequest(id) {
      await req('POST', `/admin/change-requests/${id}/approve`);
    },
    async adminRejectChangeRequest(id, reason) {
      await req('POST', `/admin/change-requests/${id}/reject`, { body: { reason } });
    },
    adminListUsers(query = {}) {
      return req<Paginated<AdminUser>>('GET', '/admin/users', {
        query: {
          q: query.q,
          role: query.role,
          is_active: query.is_active === undefined ? undefined : query.is_active ? 1 : 0,
          page: query.page,
        },
      });
    },
    async adminUpdateUser(id, patch) {
      const res = await req<{ data: AdminUser }>('PATCH', `/admin/users/${id}`, { body: patch });
      return res.data;
    },
    async adminAnonymizeUser(id, confirmEmail) {
      await req('POST', `/admin/users/${id}/anonymize`, { body: { confirm_email: confirmEmail } });
    },
    adminListReference(resource, page) {
      return req<Paginated<AdminReferenceItem>>('GET', `/admin/reference/${resource}`, {
        query: { page },
      });
    },
    async adminCreateReference(resource, input) {
      const res = await req<{ data: AdminReferenceItem }>('POST', `/admin/reference/${resource}`, {
        body: input,
      });
      return res.data;
    },
    async adminUpdateReference(resource, id, input) {
      const res = await req<{ data: AdminReferenceItem }>(
        'PATCH',
        `/admin/reference/${resource}/${id}`,
        { body: input },
      );
      return res.data;
    },
    async adminDeleteReference(resource, id) {
      await req('DELETE', `/admin/reference/${resource}/${id}`);
    },
    adminListAuditLogs(query = {}) {
      return req<Paginated<AdminAuditLog>>('GET', '/admin/audit-logs', {
        query: {
          event: query.event,
          user_id: query.user_id,
          auditable_type: query.auditable_type,
          from: query.from,
          to: query.to,
          page: query.page,
        },
      });
    },
    async adminListNotifications() {
      const res = await req<{ data: AdminNotification[] }>('GET', '/admin/notifications');
      return res.data;
    },
    async adminMarkNotificationRead(id) {
      await req('POST', `/admin/notifications/${enc(String(id))}/read`);
    },
  };
}
