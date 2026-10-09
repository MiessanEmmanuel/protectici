import type { MyEstablishment, ReferenceData } from '@/lib/api/types';
import {
  emptyDraft,
  normalizePhone,
  parseCoordinate,
  type EstablishmentDraft,
} from '@/lib/establishment-schemas';
import { formatFcfa } from '@/lib/format';

/** Champs que la liste blanche du PATCH interdit : seule une demande de modification les change. */
export const SENSITIVE_FIELDS = {
  provider: ['name', 'rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number'],
  state_force: ['name', 'force_type_id'],
} as const;

const s = (v: string | number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

/** Fiche du propriétaire → brouillon de formulaire (pour réutiliser les schémas de validation). */
export function toDraft(est: MyEstablishment): EstablishmentDraft {
  return {
    ...emptyDraft(),
    type: est.type,
    submitter_role: est.submitter_role ?? '',
    is_in_service: est.is_in_service,
    name: est.name,
    description: s(est.description),
    company_type_ids: est.company_type_ids ?? [],
    service_type_ids: est.service_type_ids ?? [],
    force_type_id: s(est.force_type_id),
    procedure_type_ids: est.procedure_type_ids ?? [],
    city_id: s(est.city_id),
    district_id: s(est.district_id),
    address: s(est.address),
    geo_description: s(est.geo_description),
    plus_code: s(est.plus_code),
    lat: s(est.lat),
    lng: s(est.lng),
    phone: s(est.phone),
    phone_alt: s(est.phone_alt),
    emergency_phone: s(est.emergency_phone),
    email: s(est.email),
    website_url: s(est.website_url),
    facebook_url: s(est.facebook_url),
    instagram_url: s(est.instagram_url),
    twitter_url: s(est.twitter_url),
    linkedin_url: s(est.linkedin_url),
    whatsapp_number: s(est.whatsapp_number),
    price_from: s(est.price_from),
    opening_hours: s(est.opening_hours),
    is_open_24h: est.is_open_24h ?? false,
    executives: est.executives.map((e) => ({
      full_name: e.full_name,
      position: e.position,
      position_label: s(e.position_label),
      is_visible: e.is_visible,
    })),
  };
}

const nz = (v: string): string | null => (v.trim() === '' ? null : v.trim());
const ph = (v: string): string | null => (v.trim() === '' ? null : normalizePhone(v));

/**
 * Corps du PATCH `/me/establishments/{type}/{slug}` : champs NON sensibles uniquement
 * (jamais name, rccm, legal_form, share_capital, corporate_purpose, approval_number, force_type_id).
 * Un champ vidé est envoyé à `null`.
 */
export function buildInfoPatch(d: EstablishmentDraft): Record<string, unknown> {
  const lat = parseCoordinate(d.lat, 90);
  const lng = parseCoordinate(d.lng, 180);
  const common = {
    description: nz(d.description),
    is_in_service: d.is_in_service,
    city_id: Number(d.city_id),
    district_id: d.district_id ? Number(d.district_id) : null,
    address: nz(d.address),
    geo_description: nz(d.geo_description),
    plus_code: nz(d.plus_code),
    lat: lat !== null && lng !== null ? lat : null,
    lng: lat !== null && lng !== null ? lng : null,
    phone: ph(d.phone),
    phone_alt: ph(d.phone_alt),
    emergency_phone: ph(d.emergency_phone),
    email: nz(d.email),
  };
  if (d.type === 'state_force') {
    return {
      ...common,
      opening_hours: nz(d.opening_hours),
      is_open_24h: d.is_open_24h,
      procedure_type_ids: d.procedure_type_ids,
    };
  }
  return {
    ...common,
    company_type_ids: d.company_type_ids,
    service_type_ids: d.service_type_ids,
    website_url: nz(d.website_url),
    facebook_url: nz(d.facebook_url),
    instagram_url: nz(d.instagram_url),
    twitter_url: nz(d.twitter_url),
    linkedin_url: nz(d.linkedin_url),
    whatsapp_number: ph(d.whatsapp_number),
    price_from: d.price_from.trim() === '' ? null : Number(d.price_from),
  };
}

/** Valeur lisible d'un champ sensible (demandes de modification). */
export function displayFieldValue(field: string, value: unknown, reference: ReferenceData): string {
  if (value === null || value === undefined || value === '') return 'Non renseigné';
  if (field === 'force_type_id') {
    return reference.state_force_types.find((t) => t.id === Number(value))?.name ?? 'Valeur inconnue';
  }
  if (field === 'share_capital' && !Number.isNaN(Number(value))) return formatFcfa(Number(value));
  return String(value);
}
