import { API_URL, USE_MOCKS } from '../env';
import { normalizePhone } from '../establishment-schemas';
import { DOCUMENT_RULES, type FileRules } from '../files';
import { createRequester, type Requester } from './http';
import type { AdminEstablishment, EstablishmentType, Paginated, SubmitterRole } from './types';

/**
 * Revendication de fiche (contrat §10.1 et §10.3) : types et appels API.
 * Module autonome (il ne modifie pas la surface `Api` commune) ; en mode démo
 * (NEXT_PUBLIC_USE_MOCKS=1), les données factices sont chargées à la demande.
 */

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface MyClaim {
  id: number;
  status: ClaimStatus;
  establishment: { type: EstablishmentType; slug: string; name: string };
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AdminClaim {
  id: number;
  status: ClaimStatus;
  establishment: {
    type: EstablishmentType;
    id: number;
    slug: string;
    name: string;
    city: { name: string };
  };
  user: { id: number; name: string; email: string } | null;
  submitter_role: SubmitterRole;
  phone: string;
  message: string | null;
  document: { name: string; mime_type: string; size_bytes: number } | null;
  rejection_reason: string | null;
  reviewer: { id: number; name: string } | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SimilarEstablishment {
  type: EstablishmentType;
  slug: string;
  name: string;
  city: { name: string };
  is_claimable: boolean;
}

export interface ClaimInput {
  submitter_role: SubmitterRole;
  phone: string;
  message?: string;
  document: File;
  consent: boolean;
}

export interface SimilarQuery {
  type: EstablishmentType;
  name: string;
  city_id?: number | string;
  phone?: string;
}

export interface ClaimsApi {
  submitClaim(type: EstablishmentType, slug: string, input: ClaimInput): Promise<MyClaim>;
  listMyClaims(): Promise<MyClaim[]>;
  findSimilarEstablishments(
    query: SimilarQuery,
    signal?: AbortSignal,
  ): Promise<SimilarEstablishment[]>;
  adminListClaims(query?: { status?: ClaimStatus; page?: number }): Promise<Paginated<AdminClaim>>;
  adminGetClaim(id: number): Promise<AdminClaim>;
  adminDownloadClaimDocument(id: number): Promise<Blob>;
  adminApproveClaim(id: number): Promise<AdminClaim>;
  adminRejectClaim(id: number, reason: string): Promise<void>;
  adminAssignOwner(type: EstablishmentType, id: number, email: string): Promise<AdminEstablishment>;
}

/** Justificatif de revendication : PDF, JPEG ou PNG, 5 Mo maximum (contrat §10.3). */
export const CLAIM_DOCUMENT_RULES: FileRules = { ...DOCUMENT_RULES, maxBytes: 5 * 1024 * 1024 };

export const CLAIM_MESSAGE_MAX = 1000;
export const CLAIM_REJECT_MIN = 10;
export const SIMILAR_NAME_MIN = 3;

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: 'En attente',
  approved: 'Acceptée',
  rejected: 'Refusée',
};

/** Segment d'URL public de la fiche selon son type. */
export function establishmentPublicPath(type: EstablishmentType, slug: string): string {
  return type === 'provider'
    ? `/annuaire/${encodeURIComponent(slug)}`
    : `/forces-etatiques/${encodeURIComponent(slug)}`;
}

export function claimPath(type: EstablishmentType, slug: string): string {
  return `/revendiquer/${type}/${encodeURIComponent(slug)}`;
}

/** Corps multipart de la revendication (consentement en « 1 », téléphone normalisé). */
export function claimFormData(input: ClaimInput): FormData {
  const fd = new FormData();
  fd.append('submitter_role', input.submitter_role);
  fd.append('phone', normalizePhone(input.phone));
  const message = input.message?.trim();
  if (message) fd.append('message', message);
  fd.append('consent', input.consent ? '1' : '0');
  fd.append('document', input.document, input.document.name);
  return fd;
}

const enc = encodeURIComponent;

export function buildClaimsApi(req: Requester): ClaimsApi {
  return {
    async submitClaim(type, slug, input) {
      const res = await req<{ data: MyClaim }>(
        'POST',
        `/establishments/${enc(type)}/${enc(slug)}/claims`,
        { formData: claimFormData(input) },
      );
      return res.data;
    },
    async listMyClaims() {
      const res = await req<{ data: MyClaim[] }>('GET', '/me/claims');
      return res.data;
    },
    async findSimilarEstablishments(query, signal) {
      const res = await req<{ data: SimilarEstablishment[] }>('GET', '/establishments/similar', {
        query: {
          type: query.type,
          name: query.name.trim(),
          city_id: query.city_id,
          phone: query.phone ? normalizePhone(query.phone) : undefined,
        },
        signal,
      });
      return res.data;
    },
    adminListClaims(query = {}) {
      return req<Paginated<AdminClaim>>('GET', '/admin/claims', {
        query: { status: query.status, page: query.page },
      });
    },
    async adminGetClaim(id) {
      const res = await req<{ data: AdminClaim }>('GET', `/admin/claims/${id}`);
      return res.data;
    },
    adminDownloadClaimDocument(id) {
      return req<Blob>('GET', `/admin/claims/${id}/document`, { responseType: 'blob' });
    },
    async adminApproveClaim(id) {
      const res = await req<{ data: AdminClaim }>('POST', `/admin/claims/${id}/approve`);
      return res.data;
    },
    async adminRejectClaim(id, reason) {
      await req('POST', `/admin/claims/${id}/reject`, { body: { reason } });
    },
    async adminAssignOwner(type, id, email) {
      const res = await req<{ data: AdminEstablishment }>(
        'POST',
        `/admin/establishments/${enc(type)}/${id}/owner`,
        { body: { email: email.trim() } },
      );
      return res.data;
    },
  };
}

/** Façade démo : le module factice n'est chargé qu'au premier appel (jamais en production). */
function lazyMockClaims(): ClaimsApi {
  const load = () => import('../mocks/claims').then((m) => m.mockClaimsApi);
  return {
    submitClaim: async (...a) => (await load()).submitClaim(...a),
    listMyClaims: async () => (await load()).listMyClaims(),
    findSimilarEstablishments: async (...a) => (await load()).findSimilarEstablishments(...a),
    adminListClaims: async (...a) => (await load()).adminListClaims(...a),
    adminGetClaim: async (...a) => (await load()).adminGetClaim(...a),
    adminDownloadClaimDocument: async (...a) => (await load()).adminDownloadClaimDocument(...a),
    adminApproveClaim: async (...a) => (await load()).adminApproveClaim(...a),
    adminRejectClaim: async (...a) => (await load()).adminRejectClaim(...a),
    adminAssignOwner: async (...a) => (await load()).adminAssignOwner(...a),
  };
}

/** Client des revendications pour les composants clients (cookies Sanctum + CSRF). */
export const claimsApi: ClaimsApi = USE_MOCKS
  ? lazyMockClaims()
  : buildClaimsApi(createRequester({ baseUrl: API_URL, timeoutMs: 30000 }));
