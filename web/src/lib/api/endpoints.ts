import { ApiError } from './errors';
import type { Query, Requester } from './http';
import type {
  AdminContactMessage,
  AdminFeedback,
  AdminFeedbackQuery,
  AdminFeedbackRow,
  AdminQuote,
  AdminQuoteRow,
  AdminReviewReport,
  AdminReviewRow,
  AntiSpamPayload,
  ContactInput,
  ContactStatus,
  FeedbackInput,
  FeedbackReceipt,
  FeedbackReply,
  FeedbackStatus,
  FeedbackTracking,
  MyReview,
  OwnerReview,
  ProviderQuote,
  QuoteReceipt,
  QuoteReplyInput,
  QuoteRequestInput,
  QuoteRecipientStatus,
  QuoteStatus,
  ReviewInput,
  ReviewReportReason,
  ReviewReportStatus,
  ReviewStatus,
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
  /** Champ piège (doit rester vide). */
  company_website?: string;
}

/** Surface de l'API utilisée par l'application (réelle ou mock). */
export interface Api {
  // Authentification
  /** 202 : message générique identique dans tous les cas (anti-énumération). Aucune session ouverte. */
  register(input: RegisterInput, idempotencyKey?: string): Promise<string>;
  /** 202 public, réponse identique dans tous les cas (aucun mot de passe renvoyé). */
  resendVerificationPublic(email: string, antispam?: AntiSpamPayload): Promise<string>;
  login(input: { email: string; password: string; remember?: boolean }): Promise<LoginResult>;
  twoFactorChallenge(input: { code?: string; recovery_code?: string }): Promise<User>;
  logout(): Promise<void>;
  getUser(): Promise<User | null>;
  forgotPassword(email: string, antispam?: AntiSpamPayload): Promise<void>;
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

  // --- Vague B : avis (contrat §8.1) ---
  /** 201 : avis `pending`. 409 si déjà un avis, 403 si propriétaire de la fiche. */
  createReview(slug: string, input: ReviewInput): Promise<MyReview>;
  listMyReviews(page?: number): Promise<Paginated<MyReview>>;
  updateMyReview(id: number, patch: Partial<ReviewInput>): Promise<MyReview>;
  deleteMyReview(id: number): Promise<void>;
  /** 204 ; rejeu = 204. */
  reportReview(id: number, input: { reason: ReviewReportReason; details?: string }): Promise<void>;
  listOwnerReviews(
    slug: string,
    query?: { status?: ReviewStatus; page?: number },
  ): Promise<Paginated<OwnerReview>>;
  /** Une seule réponse par avis (409 ensuite). */
  replyToReview(slug: string, reviewId: number, body: string): Promise<void>;
  adminListReviews(query?: {
    status?: ReviewStatus;
    provider?: string;
    q?: string;
    page?: number;
  }): Promise<Paginated<AdminReviewRow>>;
  /** Idempotent. `reason` (≥ 10 car.) requis pour `reject`. */
  adminReviewAction(id: number, action: 'approve' | 'reject', reason?: string): Promise<void>;
  adminDeleteReview(id: number): Promise<void>;
  adminListReviewReports(query?: {
    status?: ReviewReportStatus;
    page?: number;
  }): Promise<Paginated<AdminReviewReport>>;
  adminReviewReportAction(id: number, action: 'accept' | 'dismiss'): Promise<void>;

  // --- Vague B : « Dis-moi tout » (contrat §8.2) ---
  createFeedback(input: FeedbackInput, idempotencyKey: string): Promise<FeedbackReceipt>;
  /** POST (jamais d'URL) ; 404 générique si référence inconnue OU e-mail faux. */
  trackFeedback(input: { reference: string; email: string }): Promise<FeedbackTracking>;
  adminListFeedbacks(query?: AdminFeedbackQuery): Promise<Paginated<AdminFeedbackRow>>;
  adminGetFeedback(id: number): Promise<AdminFeedback>;
  adminUpdateFeedback(
    id: number,
    patch: { status?: FeedbackStatus; assigned_to?: number | null },
  ): Promise<AdminFeedback>;
  adminReplyFeedback(
    id: number,
    input: { body: string; is_internal: boolean },
    idempotencyKey?: string,
  ): Promise<FeedbackReply>;

  // --- Vague B : devis (contrat §8.3) ---
  createQuoteRequest(input: QuoteRequestInput, idempotencyKey: string): Promise<QuoteReceipt>;
  listMyQuotes(query?: {
    status?: QuoteRecipientStatus;
    page?: number;
  }): Promise<Paginated<ProviderQuote>>;
  /** Passe le destinataire à `viewed` (idempotent). */
  getMyQuote(id: number): Promise<ProviderQuote>;
  /** Une seule réponse (409 ensuite). */
  replyToQuote(id: number, input: QuoteReplyInput): Promise<void>;
  declineQuote(id: number, reason?: string): Promise<void>;
  adminListQuotes(query?: {
    status?: QuoteStatus;
    q?: string;
    page?: number;
  }): Promise<Paginated<AdminQuoteRow>>;
  adminGetQuote(id: number): Promise<AdminQuote>;
  /** Idempotent : crée les destinataires manquants (1 à 5 fiches publiées). */
  adminDispatchQuote(id: number, providerIds: number[]): Promise<AdminQuote>;
  adminUpdateQuoteStatus(id: number, status: QuoteStatus): Promise<void>;

  // --- Vague B : contact (contrat §8.4) ---
  sendContact(input: ContactInput, idempotencyKey: string): Promise<string>;
  adminListContactMessages(query?: {
    status?: ContactStatus;
    q?: string;
    page?: number;
  }): Promise<Paginated<AdminContactMessage>>;
  adminUpdateContactMessage(id: number, status: ContactStatus): Promise<void>;
  adminReplyContactMessage(id: number, body: string): Promise<void>;
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
    async resendVerificationPublic(email, antispam) {
      const res = await req<{ message?: string }>('POST', '/auth/verification/resend', {
        body: { email, turnstile_token: antispam?.turnstile_token },
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
    async forgotPassword(email, antispam) {
      await req('POST', '/auth/forgot-password', {
        body: { email, turnstile_token: antispam?.turnstile_token },
      });
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

    // ---------- Vague B ----------
    async createReview(slug, input) {
      const res = await req<{ data: MyReview }>('POST', `/providers/${enc(slug)}/reviews`, {
        body: input,
      });
      return res.data;
    },
    listMyReviews(page) {
      return req<Paginated<MyReview>>('GET', '/me/reviews', { query: { page } });
    },
    async updateMyReview(id, patch) {
      const res = await req<{ data: MyReview }>('PATCH', `/me/reviews/${id}`, { body: patch });
      return res.data;
    },
    async deleteMyReview(id) {
      await req('DELETE', `/me/reviews/${id}`);
    },
    async reportReview(id, input) {
      await req('POST', `/reviews/${id}/report`, { body: input });
    },
    listOwnerReviews(slug, query = {}) {
      return req<Paginated<OwnerReview>>('GET', `${mine('provider', slug)}/reviews`, {
        query: { status: query.status, page: query.page },
      });
    },
    async replyToReview(slug, reviewId, body) {
      await req('POST', `${mine('provider', slug)}/reviews/${reviewId}/reply`, { body: { body } });
    },
    adminListReviews(query = {}) {
      return req<Paginated<AdminReviewRow>>('GET', '/admin/reviews', {
        query: { status: query.status, provider: query.provider, q: query.q, page: query.page },
      });
    },
    async adminReviewAction(id, action, reason) {
      await req('POST', `/admin/reviews/${id}/${action}`, {
        body: reason !== undefined ? { reason } : undefined,
      });
    },
    async adminDeleteReview(id) {
      await req('DELETE', `/admin/reviews/${id}`);
    },
    adminListReviewReports(query = {}) {
      return req<Paginated<AdminReviewReport>>('GET', '/admin/review-reports', {
        query: { status: query.status, page: query.page },
      });
    },
    async adminReviewReportAction(id, action) {
      await req('POST', `/admin/review-reports/${id}/${action}`);
    },

    async createFeedback(input, idempotencyKey) {
      const res = await req<{ data: FeedbackReceipt }>('POST', '/feedbacks', {
        body: input,
        idempotencyKey,
      });
      return res.data;
    },
    async trackFeedback(input) {
      const res = await req<{ data: FeedbackTracking }>('POST', '/feedbacks/track', {
        body: input,
      });
      return res.data;
    },
    adminListFeedbacks(query = {}) {
      return req<Paginated<AdminFeedbackRow>>('GET', '/admin/feedbacks', {
        query: {
          status: query.status,
          action_type: query.action_type,
          provider: query.provider,
          assigned_to: query.assigned_to,
          q: query.q,
          sort: query.sort,
          page: query.page,
        },
      });
    },
    async adminGetFeedback(id) {
      const res = await req<{ data: AdminFeedback }>('GET', `/admin/feedbacks/${id}`);
      return res.data;
    },
    async adminUpdateFeedback(id, patch) {
      const res = await req<{ data: AdminFeedback }>('PATCH', `/admin/feedbacks/${id}`, {
        body: patch,
      });
      return res.data;
    },
    async adminReplyFeedback(id, input, idempotencyKey) {
      const res = await req<{ data: FeedbackReply }>('POST', `/admin/feedbacks/${id}/replies`, {
        body: input,
        idempotencyKey,
      });
      return res.data;
    },

    async createQuoteRequest(input, idempotencyKey) {
      const res = await req<{ data: QuoteReceipt }>('POST', '/quote-requests', {
        body: input,
        idempotencyKey,
      });
      return res.data;
    },
    listMyQuotes(query = {}) {
      return req<Paginated<ProviderQuote>>('GET', '/me/quote-requests', {
        query: { status: query.status, page: query.page },
      });
    },
    async getMyQuote(id) {
      const res = await req<{ data: ProviderQuote }>('GET', `/me/quote-requests/${id}`);
      return res.data;
    },
    async replyToQuote(id, input) {
      await req('POST', `/me/quote-requests/${id}/reply`, { body: input });
    },
    async declineQuote(id, reason) {
      await req('POST', `/me/quote-requests/${id}/decline`, {
        body: reason ? { reason } : undefined,
      });
    },
    adminListQuotes(query = {}) {
      return req<Paginated<AdminQuoteRow>>('GET', '/admin/quote-requests', {
        query: { status: query.status, q: query.q, page: query.page },
      });
    },
    async adminGetQuote(id) {
      const res = await req<{ data: AdminQuote }>('GET', `/admin/quote-requests/${id}`);
      return res.data;
    },
    async adminDispatchQuote(id, providerIds) {
      const res = await req<{ data: AdminQuote }>('POST', `/admin/quote-requests/${id}/dispatch`, {
        body: { provider_ids: providerIds },
      });
      return res.data;
    },
    async adminUpdateQuoteStatus(id, status) {
      await req('PATCH', `/admin/quote-requests/${id}`, { body: { status } });
    },

    async sendContact(input, idempotencyKey) {
      const res = await req<{ data: { message: string } }>('POST', '/contact', {
        body: input,
        idempotencyKey,
      });
      return res?.data?.message ?? 'Merci, votre message a bien été envoyé.';
    },
    adminListContactMessages(query = {}) {
      return req<Paginated<AdminContactMessage>>('GET', '/admin/contact-messages', {
        query: { status: query.status, q: query.q, page: query.page },
      });
    },
    async adminUpdateContactMessage(id, status) {
      await req('PATCH', `/admin/contact-messages/${id}`, { body: { status } });
    },
    async adminReplyContactMessage(id, body) {
      await req('POST', `/admin/contact-messages/${id}/reply`, { body: { body } });
    },
  };
}
