/** Types fidèles à docs/api-contract.md §2. Noms de champs en snake_case, comme l'API. */

export type Role = 'user' | 'provider' | 'editor' | 'admin';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  email_verified: boolean;
  two_factor_enabled: boolean;
  created_at: string;
}

export interface District {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}
export interface City {
  id: number;
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  districts: District[];
}
export interface Option {
  id: number;
  slug: string;
  name: string;
}

export interface ReferenceData {
  cities: City[];
  company_types: Option[];
  service_types: Option[];
  state_force_types: Option[];
  procedure_types: Option[];
}

export interface NamedSlug {
  name: string;
  slug: string;
}

export interface ProviderSummary {
  slug: string;
  name: string;
  logo_url: string | null;
  city: NamedSlug;
  district: NamedSlug | null;
  phone: string;
  services: NamedSlug[];
  price_from: number | null;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  is_featured: boolean;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
}

export type ExecutivePosition =
  'general_manager' | 'commercial_manager' | 'operations_manager' | 'other';

export interface Executive {
  full_name: string;
  position: ExecutivePosition;
  position_label: string | null;
}

export interface Socials {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  whatsapp: string | null;
}

export interface ProviderDetail extends ProviderSummary {
  description: string;
  address: string | null;
  geo_description: string | null;
  plus_code: string | null;
  email: string | null;
  website_url: string | null;
  emergency_phone: string | null;
  socials: Socials;
  company_types: Option[];
  legal: {
    legal_form: string | null;
    share_capital: number | null;
    rccm: string | null;
    approval_number: string | null;
    corporate_purpose: string | null;
  };
  executives: Executive[];
  gallery: { url: string; alt: string }[];
  views_count: number;
  is_favorite: boolean | null;
}

export interface StateForceSummary {
  slug: string;
  name: string;
  force_type: Option;
  phone: string | null;
  emergency_phone: string | null;
  city: NamedSlug;
  district: NamedSlug | null;
  address: string | null;
  is_open_24h: boolean;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
}

export interface StateForceDetail extends StateForceSummary {
  description: string;
  email: string | null;
  geo_description: string | null;
  plus_code: string | null;
  opening_hours: string | null;
  procedures: { slug: string; name: string; notes: string | null }[];
}

export interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  created_at: string;
  provider_reply: string | null;
  provider_replied_at: string | null;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
  links: { next: string | null; prev: string | null };
}

export interface HomeData {
  stats: { providers: number; state_forces: number; service_types: number };
  popular_providers: ProviderSummary[];
}

export interface MapMarker {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

/** Réponse de /auth/login : utilisateur connecté, ou étape 2FA requise. */
export type LoginResult = { kind: 'user'; user: User } | { kind: 'two_factor' };

export interface TwoFactorEnable {
  secret: string;
  qr_svg: string;
}

/* ---------- Paramètres de requête ---------- */

export interface GeoParams {
  lat?: number;
  lng?: number;
  radius_km?: number;
}

export interface ProviderQuery extends GeoParams {
  q?: string;
  city?: string;
  district?: string;
  service?: string[];
  company_type?: string[];
  sort?: 'name' | '-rating' | '-popular' | 'distance';
  page?: number;
  per_page?: number;
}

export interface StateForceQuery extends GeoParams {
  q?: string;
  city?: string;
  district?: string;
  type?: string[];
  procedure?: string[];
  sort?: 'name' | 'distance';
  page?: number;
  per_page?: number;
}

export type MarkerQuery =
  | { kind: 'providers'; filters: Omit<ProviderQuery, 'page' | 'per_page' | 'sort'>; bbox?: string }
  | {
      kind: 'state_forces';
      filters: Omit<StateForceQuery, 'page' | 'per_page' | 'sort'>;
      bbox?: string;
    };

/* =====================================================================================
 * Phase 3 — Vague A : établissements, espace prestataire, administration
 * (docs/api-contract.md §7.1 à 7.3)
 * ===================================================================================== */

export type EstablishmentType = 'provider' | 'state_force';
export type EstablishmentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type SubmitterRole = 'manager' | 'employee' | 'other';
export type MediaCollection = 'logo' | 'cover' | 'gallery';
export type DocumentType = 'approval_certificate' | 'rccm_extract' | 'id_document' | 'other';

export interface MyEstablishmentSummary {
  type: EstablishmentType;
  slug: string;
  name: string;
  status: EstablishmentStatus;
  rejection_reason: string | null;
  is_visible: boolean;
  is_verified: boolean;
  submitted_at: string;
  reviewed_at: string | null;
  pending_change_requests: number;
}

export interface OwnerExecutive {
  id: number;
  full_name: string;
  position: ExecutivePosition;
  position_label: string | null;
  is_visible: boolean;
}

/** Dirigeant tel qu'envoyé à l'API (remplacement complet de la liste). */
export interface ExecutiveInput {
  full_name: string;
  position: ExecutivePosition;
  position_label?: string | null;
  is_visible: boolean;
}

export interface EstablishmentMedia {
  id: number;
  collection: MediaCollection;
  url: string;
  alt: string;
}

export interface EstablishmentDocument {
  id: number;
  type: DocumentType;
  original_name: string;
  size_bytes: number;
  uploaded_at: string;
  verified_at: string | null;
}

export interface ChangeRequest {
  id: number;
  changes: Record<string, { old: unknown; new: unknown }>;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/**
 * Fiche vue par son propriétaire. Les relations sont des identifiants. Les champs propres à un
 * type sont optionnels (ex. `service_type_ids` n'existe que pour un prestataire).
 */
export interface MyEstablishment extends MyEstablishmentSummary {
  description: string | null;
  phone: string | null;
  phone_alt: string | null;
  emergency_phone: string | null;
  email: string | null;
  address: string | null;
  city_id: number | null;
  district_id: number | null;
  geo_description: string | null;
  plus_code: string | null;
  lat: number | null;
  lng: number | null;
  submitter_role: SubmitterRole | null;
  is_in_service: boolean;
  executives: OwnerExecutive[];
  media: EstablishmentMedia[];
  documents: EstablishmentDocument[];
  change_requests: ChangeRequest[];
  // prestataire
  company_type_ids?: number[];
  service_type_ids?: number[];
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  whatsapp_number?: string | null;
  price_from?: number | null;
  rccm?: string | null;
  legal_form?: string | null;
  share_capital?: number | null;
  corporate_purpose?: string | null;
  approval_number?: string | null;
  approval_expires_at?: string | null;
  // force étatique
  force_type_id?: number | null;
  procedure_type_ids?: number[];
  opening_hours?: string | null;
  is_open_24h?: boolean;
}

export interface AdminEstablishmentRow {
  type: EstablishmentType;
  id: number;
  slug: string;
  name: string;
  status: EstablishmentStatus;
  is_visible: boolean;
  is_verified: boolean;
  is_featured: boolean;
  city: { name: string };
  owner: { id: number; name: string; email: string } | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface AuditEntry {
  event: string;
  user: { name: string } | null;
  created_at: string;
}

export interface AdminEstablishment extends MyEstablishment {
  id: number;
  owner: { id: number; first_name: string; last_name: string; email: string; phone: string | null };
  is_featured: boolean;
  views_count: number;
  reviewed_by: { id: number; name: string } | null;
  audit: AuditEntry[];
}

export interface AdminAuditLog {
  id: number;
  event: string;
  user: { id: number; name: string } | null;
  auditable_type: string;
  auditable_id: number;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminDashboard {
  pending_providers: number;
  pending_state_forces: number;
  pending_change_requests: number;
  users_total: number;
  providers_approved: number;
  state_forces_approved: number;
  recent_audit: AdminAuditLog[];
}

export interface AdminChangeRequestRow {
  id: number;
  type: EstablishmentType;
  establishment: { id: number; name: string };
  changes: Record<string, { old: unknown; new: unknown }>;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  establishments_count: number;
}

export type ReferenceResource =
  | 'cities'
  | 'districts'
  | 'company-types'
  | 'service-types'
  | 'state-force-types'
  | 'procedure-types'
  | 'feedback-topics'
  | 'post-categories';

export interface AdminReferenceItem {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_visible: boolean;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  city_id?: number | null;
  parent_id?: number | null;
}

export type AdminReferenceInput = Partial<Omit<AdminReferenceItem, 'id' | 'slug'>>;

/** Forme non spécifiée par le contrat : lecture tolérante (voir rapport, écarts). */
export interface AdminNotification {
  id: number | string;
  type: string;
  message: string | null;
  read_at: string | null;
  created_at: string;
}

export type EstablishmentAction =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'restore'
  | 'verify'
  | 'unverify';

export interface ProviderCreateInput {
  type: 'provider';
  name: string;
  company_type_ids: number[];
  service_type_ids: number[];
  phone: string;
  city_id: number;
  submitter_role: SubmitterRole;
  is_in_service: boolean;
  description?: string;
  phone_alt?: string;
  emergency_phone?: string;
  email?: string;
  website_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  whatsapp_number?: string;
  address?: string;
  district_id?: number;
  geo_description?: string;
  plus_code?: string;
  lat?: number;
  lng?: number;
  price_from?: number;
  rccm?: string;
  legal_form?: string;
  share_capital?: number;
  corporate_purpose?: string;
  approval_number?: string;
  approval_expires_at?: string;
  executives?: ExecutiveInput[];
  consent: true;
}

export interface StateForceCreateInput {
  type: 'state_force';
  force_type_id: number;
  name: string;
  city_id: number;
  description?: string;
  phone?: string;
  phone_alt?: string;
  emergency_phone?: string;
  email?: string;
  address?: string;
  district_id?: number;
  geo_description?: string;
  plus_code?: string;
  lat?: number;
  lng?: number;
  opening_hours?: string;
  is_open_24h?: boolean;
  procedure_type_ids?: number[];
  consent: true;
}

export type EstablishmentCreateInput = ProviderCreateInput | StateForceCreateInput;

export interface AdminEstablishmentQuery {
  type?: EstablishmentType;
  status?: EstablishmentStatus;
  q?: string;
  sort?: '-submitted_at' | 'name';
  page?: number;
  per_page?: number;
}

export interface AdminUserQuery {
  q?: string;
  role?: Role;
  is_active?: boolean;
  page?: number;
}

export interface AuditLogQuery {
  event?: string;
  user_id?: number;
  auditable_type?: string;
  from?: string;
  to?: string;
  page?: number;
}
