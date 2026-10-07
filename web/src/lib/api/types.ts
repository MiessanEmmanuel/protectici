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
