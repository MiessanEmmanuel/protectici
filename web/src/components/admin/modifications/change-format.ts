import type { ReferenceData } from '@/lib/api/types';
import { FIELD_LABELS } from '@/lib/labels';

const EXTRA_FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  phone: 'Téléphone',
  phone_alt: 'Second téléphone',
  emergency_phone: 'Téléphone d’urgence',
  email: 'Adresse e-mail',
  address: 'Adresse',
  city_id: 'Ville',
  district_id: 'Quartier',
  geo_description: 'Repères géographiques',
  plus_code: 'Plus Code',
  lat: 'Latitude',
  lng: 'Longitude',
  website_url: 'Site web',
  facebook_url: 'Facebook',
  instagram_url: 'Instagram',
  twitter_url: 'X (Twitter)',
  linkedin_url: 'LinkedIn',
  whatsapp_number: 'Numéro WhatsApp',
  price_from: 'Tarif de départ (FCFA)',
  approval_expires_at: 'Fin de validité de l’agrément',
  company_type_ids: 'Types d’entreprise',
  service_type_ids: 'Types de service',
  procedure_type_ids: 'Types de démarche',
  opening_hours: 'Horaires',
  is_open_24h: 'Ouvert 24 h/24',
  is_in_service: 'En service',
  is_featured: 'Mis en avant',
};

/** Libellé français d'un champ ; l'identifiant brut est conservé s'il est inconnu. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? EXTRA_FIELD_LABELS[field] ?? field;
}

export const EMPTY_VALUE = '(vide)';

function names(ids: unknown[], options: { id: number; name: string }[] | undefined): string {
  return ids
    .map((id) => options?.find((o) => o.id === Number(id))?.name ?? `n° ${String(id)}`)
    .join(', ');
}

/**
 * Valeur d'une demande de modification en texte lisible : null → « (vide) », booléen → Oui/Non,
 * tableaux → liste, identifiants → noms quand le référentiel est chargé.
 */
export function formatChangeValue(field: string, value: unknown, reference?: ReferenceData | null): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_VALUE;
    const lists: Record<string, { id: number; name: string }[] | undefined> = {
      company_type_ids: reference?.company_types,
      service_type_ids: reference?.service_types,
      procedure_type_ids: reference?.procedure_types,
    };
    if (field in lists) return names(value, lists[field]);
    return value.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'number' || typeof value === 'string') {
    if (field === 'force_type_id') return names([value], reference?.state_force_types);
    if (field === 'city_id') return names([value], reference?.cities);
    if (field === 'district_id') {
      return names([value], reference?.cities.flatMap((c) => c.districts));
    }
    return String(value);
  }
  return JSON.stringify(value);
}
