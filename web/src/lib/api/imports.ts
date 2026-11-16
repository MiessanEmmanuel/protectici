import { API_URL, USE_MOCKS } from '../env';
import { createRequester, type Requester } from './http';
import type { EstablishmentType, Paginated } from './types';

/**
 * Import Excel des fiches (contrat docs/api-contract.md §10.1–10.2, rôle admin + 2FA).
 * Le contrôle d'accès est fait par l'API ; ces fonctions ne font que relayer les appels.
 */

export type ImportStatus =
  | 'uploaded'
  | 'analyzing'
  | 'ready'
  | 'importing'
  | 'done'
  | 'failed'
  | 'cancelled';
export type ImportPublishMode = 'publish' | 'pending';
export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';
export type ImportDecision = 'skip' | 'create';
export type DuplicateReason = 'name_city' | 'phone' | 'email' | 'rccm' | 'approval_number' | 'file';

export interface AdminImport {
  id: number;
  type: EstablishmentType;
  status: ImportStatus;
  publish_mode: ImportPublishMode;
  original_name: string;
  rows_total: number;
  rows_valid: number;
  rows_invalid: number;
  rows_duplicate: number;
  rows_created: number;
  failure_message: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
  confirmed_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  can_confirm: boolean;
  can_cancel: boolean;
}

export interface AdminImportRow {
  /** N° de ligne Excel (en-tête = 1). */
  line: number;
  name: string | null;
  city: string | null;
  status: ImportRowStatus;
  errors: { column: string; message: string }[];
  /** `type = "row"` et `reason = "file"` : doublon d'une ligne précédente du fichier (`id` = n° de ligne). */
  duplicate_of: {
    type: EstablishmentType | 'row';
    id: number;
    name: string;
    city: string;
    reason: DuplicateReason;
  } | null;
  decision: ImportDecision | null;
}

export interface ImportUploadInput {
  type: EstablishmentType;
  publish_mode: ImportPublishMode;
  file: File;
}

export interface ImportRowsQuery {
  status?: ImportRowStatus;
  page?: number;
  per_page?: number;
}

export interface ImportsApi {
  list(query?: { type?: EstablishmentType; page?: number }): Promise<Paginated<AdminImport>>;
  get(id: number): Promise<AdminImport>;
  rows(id: number, query?: ImportRowsQuery): Promise<Paginated<AdminImportRow>>;
  upload(input: ImportUploadInput): Promise<AdminImport>;
  decide(id: number, decisions: { line: number; decision: ImportDecision }[]): Promise<AdminImport>;
  confirm(id: number): Promise<AdminImport>;
  cancel(id: number): Promise<{ data: AdminImport; deleted_count: number }>;
}

const BASE = '/admin/establishment-imports';

/** Lien direct de téléchargement du modèle (navigation de premier niveau : cookies de session inclus). */
export function importTemplateUrl(type: EstablishmentType): string {
  return `${API_URL}/api/v1${BASE}/template/${type}`;
}

/** Lien direct du rapport d'erreurs `.xlsx` (410 si le fichier d'origine a été purgé). */
export function importReportUrl(id: number): string {
  return `${API_URL}/api/v1${BASE}/${id}/report`;
}

export function buildImportsApi(req: Requester): ImportsApi {
  return {
    list(query = {}) {
      return req<Paginated<AdminImport>>('GET', BASE, {
        query: { type: query.type, page: query.page },
      });
    },
    async get(id) {
      const res = await req<{ data: AdminImport }>('GET', `${BASE}/${id}`);
      return res.data;
    },
    rows(id, query = {}) {
      return req<Paginated<AdminImportRow>>('GET', `${BASE}/${id}/rows`, {
        query: {
          'filter[status]': query.status,
          page: query.page,
          per_page: query.per_page,
        },
      });
    },
    async upload({ type, publish_mode, file }) {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('publish_mode', publish_mode);
      formData.append('file', file);
      const res = await req<{ data: AdminImport }>('POST', BASE, { formData });
      return res.data;
    },
    async decide(id, decisions) {
      const res = await req<{ data: AdminImport }>('PATCH', `${BASE}/${id}/rows`, {
        body: { decisions },
      });
      return res.data;
    },
    async confirm(id) {
      const res = await req<{ data: AdminImport }>('POST', `${BASE}/${id}/confirm`);
      return res.data;
    },
    async cancel(id) {
      const res = await req<{ data: AdminImport; meta?: { deleted_count?: number } }>(
        'POST',
        `${BASE}/${id}/cancel`,
      );
      return { data: res.data, deleted_count: res.meta?.deleted_count ?? 0 };
    },
  };
}

/** Données factices chargées à la demande (NEXT_PUBLIC_USE_MOCKS=1 uniquement). */
function lazyMockImports(): ImportsApi {
  const load = async () => (await import('../mocks/imports')).mockImportsApi;
  return {
    list: async (query) => (await load()).list(query),
    get: async (id) => (await load()).get(id),
    rows: async (id, query) => (await load()).rows(id, query),
    upload: async (input) => (await load()).upload(input),
    decide: async (id, decisions) => (await load()).decide(id, decisions),
    confirm: async (id) => (await load()).confirm(id),
    cancel: async (id) => (await load()).cancel(id),
  };
}

/** Client des imports pour les composants clients (cookies Sanctum + CSRF). */
export const importsApi: ImportsApi = USE_MOCKS
  ? lazyMockImports()
  : buildImportsApi(createRequester({ baseUrl: API_URL, timeoutMs: 30000 }));
