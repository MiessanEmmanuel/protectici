import { z } from 'zod';
import type {
  DocumentType,
  EstablishmentCreateInput,
  EstablishmentType,
  ExecutiveInput,
  ExecutivePosition,
  SubmitterRole,
} from './api/types';
import { checkFile, DOCUMENT_RULES, MAX_DOCUMENTS } from './files';
import { validate, type ValidationResult } from './validation';

/**
 * Brouillon et validation de l'inscription d'établissement (UX uniquement : le serveur fait foi,
 * security.md §1 et §14). Le brouillon vit en mémoire : jamais de stockage navigateur.
 */

export interface ExecutiveDraft {
  full_name: string;
  position: ExecutivePosition;
  position_label: string;
  is_visible: boolean;
}

export interface DocumentDraft {
  file: File;
  type: DocumentType;
}

export interface EstablishmentDraft {
  type: EstablishmentType | '';
  submitter_role: SubmitterRole | '';
  is_in_service: boolean;
  name: string;
  description: string;
  company_type_ids: number[];
  service_type_ids: number[];
  force_type_id: string;
  procedure_type_ids: number[];
  city_id: string;
  district_id: string;
  address: string;
  geo_description: string;
  plus_code: string;
  lat: string;
  lng: string;
  rccm: string;
  legal_form: string;
  share_capital: string;
  corporate_purpose: string;
  approval_number: string;
  approval_expires_at: string;
  executives: ExecutiveDraft[];
  phone: string;
  phone_alt: string;
  emergency_phone: string;
  email: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  twitter_url: string;
  linkedin_url: string;
  whatsapp_number: string;
  price_from: string;
  opening_hours: string;
  is_open_24h: boolean;
  documents: DocumentDraft[];
  consent: boolean;
}

export function emptyDraft(): EstablishmentDraft {
  return {
    type: '',
    submitter_role: '',
    is_in_service: true,
    name: '',
    description: '',
    company_type_ids: [],
    service_type_ids: [],
    force_type_id: '',
    procedure_type_ids: [],
    city_id: '',
    district_id: '',
    address: '',
    geo_description: '',
    plus_code: '',
    lat: '',
    lng: '',
    rccm: '',
    legal_form: '',
    share_capital: '',
    corporate_purpose: '',
    approval_number: '',
    approval_expires_at: '',
    executives: [],
    phone: '',
    phone_alt: '',
    emergency_phone: '',
    email: '',
    website_url: '',
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    linkedin_url: '',
    whatsapp_number: '',
    price_from: '',
    opening_hours: '',
    is_open_24h: false,
    documents: [],
    consent: false,
  };
}

/* ------------------------------ Normalisations ------------------------------ */

/** Numéro saisi → E.164 : espaces retirés, « 00 » → « + », 10 chiffres → préfixe +225. */
export function normalizePhone(raw: string): string {
  let v = raw.trim().replace(/[\s.\-()]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (/^\d{10}$/.test(v)) v = `+225${v}`;
  return v;
}

const E164 = /^\+[1-9]\d{7,14}$/;

/** Coordonnée décimale (virgule tolérée) dans ±limit, sinon null. */
export function parseCoordinate(value: string, limit: number): number | null {
  const v = value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/* --------------------------------- Schémas --------------------------------- */

const text = (max: number, label: string) =>
  z.string().trim().max(max, { error: `${label} est trop long (${max} caractères maximum).` });

const requiredText = (max: number, label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(1, { error: `${label} est obligatoire.` })
    .max(max, { error: `${label} est trop long (${max} caractères maximum).` });

const phoneRequired = z
  .string({ error: 'Le numéro de téléphone est obligatoire.' })
  .trim()
  .min(1, { error: 'Le numéro de téléphone est obligatoire.' })
  .refine((v) => E164.test(normalizePhone(v)), {
    error: 'Numéro invalide. Exemple : +225 07 09 44 51 11 ou 0709445111.',
  });

const phoneOptional = z
  .string()
  .trim()
  .refine((v) => v === '' || E164.test(normalizePhone(v)), {
    error: 'Numéro invalide. Exemple : +225 07 09 44 51 11 ou 0709445111.',
  });

const urlOptional = z
  .string()
  .trim()
  .max(255, { error: 'L’adresse est trop longue (255 caractères maximum).' })
  .refine(
    (v) => {
      if (v === '') return true;
      try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { error: 'L’adresse doit commencer par https:// ou http://.' },
  );

const emailOptional = z
  .string()
  .trim()
  .max(255, { error: 'L’adresse e-mail est trop longue.' })
  .refine((v) => v === '' || z.email().safeParse(v).success, {
    error: 'L’adresse e-mail n’est pas valide.',
  });

const integerOptional = (label: string, max = 999_999_999_999) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= max), {
      error: `${label} doit être un nombre entier positif.`,
    });

const coordinate = (limit: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || parseCoordinate(v, limit) !== null, {
      error: `${label} invalide (entre -${limit} et ${limit}).`,
    });

const positions = ['general_manager', 'commercial_manager', 'operations_manager', 'other'] as const;

const executive = z
  .object({
    full_name: requiredText(150, 'Le nom du dirigeant'),
    position: z.enum(positions, { error: 'Choisissez une fonction.' }),
    position_label: text(100, 'La fonction'),
    is_visible: z.boolean(),
  })
  .refine((e) => e.position !== 'other' || e.position_label.length > 0, {
    path: ['position_label'],
    error: 'Précisez la fonction.',
  });

const typeStep = z.object({
  type: z.enum(['provider', 'state_force'], {
    error: 'Choisissez le type d’établissement.',
  }),
});

const declarantStep = z.object({
  submitter_role: z.enum(['manager', 'employee', 'other'], {
    error: 'Indiquez votre qualité.',
  }),
  is_in_service: z.boolean(),
});

const providerIdentity = z.object({
  name: requiredText(255, 'La raison sociale'),
  company_type_ids: z.array(z.number()).min(1, { error: 'Choisissez au moins un type d’entreprise.' }),
  service_type_ids: z.array(z.number()).min(1, { error: 'Choisissez au moins un service.' }),
  description: text(5000, 'La description'),
});

const forceIdentity = z.object({
  name: requiredText(255, 'Le nom de la structure'),
  force_type_id: z
    .string({ error: 'Choisissez le type de structure.' })
    .min(1, { error: 'Choisissez le type de structure.' }),
  procedure_type_ids: z.array(z.number()),
  description: text(5000, 'La description'),
});

const locationStep = z
  .object({
    city_id: z
      .string({ error: 'Choisissez une ville.' })
      .min(1, { error: 'Choisissez une ville.' }),
    district_id: z.string(),
    address: text(255, 'L’adresse'),
    geo_description: text(500, 'Les repères géographiques'),
    plus_code: text(32, 'Le Plus Code'),
    lat: coordinate(90, 'La latitude'),
    lng: coordinate(180, 'La longitude'),
  })
  .refine((v) => (v.lat === '') === (v.lng === ''), {
    path: ['lng'],
    error: 'Renseignez la latitude et la longitude ensemble, ou aucune des deux.',
  });

const legalStep = z.object({
  rccm: text(50, 'Le numéro RCCM'),
  legal_form: text(100, 'La forme juridique'),
  share_capital: integerOptional('Le capital social'),
  corporate_purpose: text(1000, 'L’objet social'),
  approval_number: text(50, 'Le numéro d’agrément'),
  approval_expires_at: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      error: 'Date invalide (format AAAA-MM-JJ).',
    }),
  executives: z.array(executive).max(10, { error: '10 dirigeants au maximum.' }),
});

const providerContacts = z.object({
  phone: phoneRequired,
  phone_alt: phoneOptional,
  emergency_phone: phoneOptional,
  email: emailOptional,
  website_url: urlOptional,
  facebook_url: urlOptional,
  instagram_url: urlOptional,
  twitter_url: urlOptional,
  linkedin_url: urlOptional,
  whatsapp_number: phoneOptional,
  price_from: integerOptional('Le tarif de départ', 100_000_000),
});

const forceContacts = z.object({
  phone: phoneOptional,
  phone_alt: phoneOptional,
  emergency_phone: phoneOptional,
  email: emailOptional,
  opening_hours: text(255, 'Les horaires'),
  is_open_24h: z.boolean(),
});

const documentsStep = z.object({
  documents: z
    .array(z.object({ file: z.instanceof(File), type: z.string() }))
    .max(MAX_DOCUMENTS, { error: `${MAX_DOCUMENTS} justificatifs au maximum.` })
    .superRefine((docs, ctx) => {
      docs.forEach((d, i) => {
        const problem = checkFile(d.file, DOCUMENT_RULES);
        if (problem) ctx.addIssue({ code: 'custom', path: [i, 'file'], message: problem });
      });
    }),
});

const reviewStep = z.object({
  consent: z.literal(true, {
    error: 'Vous devez accepter le traitement de vos données pour envoyer la demande.',
  }),
});

/* ----------------------------------- Étapes ----------------------------------- */

export type StepId =
  | 'type'
  | 'declarant'
  | 'identity'
  | 'location'
  | 'legal'
  | 'contacts'
  | 'documents'
  | 'review';

const STEP_LABELS: Record<StepId, string> = {
  type: 'Type d’établissement',
  declarant: 'Votre qualité',
  identity: 'Identité',
  location: 'Localisation',
  legal: 'Informations légales et dirigeants',
  contacts: 'Contacts et réseaux',
  documents: 'Justificatifs',
  review: 'Récapitulatif',
};

/** Étapes à parcourir : l'étape « légale » n'existe que pour un prestataire privé. */
export function stepsFor(type: EstablishmentType | ''): { id: StepId; label: string }[] {
  const ids: StepId[] =
    type === 'state_force'
      ? ['type', 'declarant', 'identity', 'location', 'contacts', 'documents', 'review']
      : ['type', 'declarant', 'identity', 'location', 'legal', 'contacts', 'documents', 'review'];
  return ids.map((id) => ({ id, label: STEP_LABELS[id] }));
}

export function schemaForStep(step: StepId, type: EstablishmentType | '') {
  switch (step) {
    case 'type':
      return typeStep;
    case 'declarant':
      return declarantStep;
    case 'identity':
      return type === 'state_force' ? forceIdentity : providerIdentity;
    case 'location':
      return locationStep;
    case 'legal':
      return legalStep;
    case 'contacts':
      return type === 'state_force' ? forceContacts : providerContacts;
    case 'documents':
      return documentsStep;
    case 'review':
      return reviewStep;
  }
}

/** Valide une étape. Les clés d'erreur sont les noms de champs (`executives.0.full_name`…). */
export function validateStep(step: StepId, draft: EstablishmentDraft): ValidationResult<unknown> {
  return validate(schemaForStep(step, draft.type), draft);
}

/* ------------------------------ Envoi à l'API ------------------------------ */

const str = (v: string): string | undefined => {
  const t = v.trim();
  return t === '' ? undefined : t;
};
const int = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));
const phone = (v: string): string | undefined => (v.trim() === '' ? undefined : normalizePhone(v));

/** Convertit le brouillon validé en corps de `POST /establishments` (champs vides omis). */
export function buildCreateInput(draft: EstablishmentDraft): EstablishmentCreateInput {
  const lat = parseCoordinate(draft.lat, 90);
  const lng = parseCoordinate(draft.lng, 180);
  const geo = {
    description: str(draft.description),
    city_id: Number(draft.city_id),
    district_id: int(draft.district_id),
    address: str(draft.address),
    geo_description: str(draft.geo_description),
    plus_code: str(draft.plus_code),
    ...(lat !== null && lng !== null ? { lat, lng } : {}),
  };
  if (draft.type === 'state_force') {
    return {
      type: 'state_force',
      name: draft.name.trim(),
      force_type_id: Number(draft.force_type_id),
      ...geo,
      phone: phone(draft.phone),
      phone_alt: phone(draft.phone_alt),
      emergency_phone: phone(draft.emergency_phone),
      email: str(draft.email),
      opening_hours: str(draft.opening_hours),
      is_open_24h: draft.is_open_24h,
      procedure_type_ids: draft.procedure_type_ids.length ? draft.procedure_type_ids : undefined,
      consent: true,
    };
  }
  const executives: ExecutiveInput[] = draft.executives.map((e) => ({
    full_name: e.full_name.trim(),
    position: e.position,
    position_label: e.position === 'other' ? e.position_label.trim() : null,
    is_visible: e.is_visible,
  }));
  return {
    type: 'provider',
    name: draft.name.trim(),
    company_type_ids: draft.company_type_ids,
    service_type_ids: draft.service_type_ids,
    phone: normalizePhone(draft.phone),
    submitter_role: draft.submitter_role as SubmitterRole,
    is_in_service: draft.is_in_service,
    ...geo,
    phone_alt: phone(draft.phone_alt),
    emergency_phone: phone(draft.emergency_phone),
    email: str(draft.email),
    website_url: str(draft.website_url),
    facebook_url: str(draft.facebook_url),
    instagram_url: str(draft.instagram_url),
    twitter_url: str(draft.twitter_url),
    linkedin_url: str(draft.linkedin_url),
    whatsapp_number: phone(draft.whatsapp_number),
    price_from: int(draft.price_from),
    rccm: str(draft.rccm),
    legal_form: str(draft.legal_form),
    share_capital: int(draft.share_capital),
    corporate_purpose: str(draft.corporate_purpose),
    approval_number: str(draft.approval_number),
    approval_expires_at: str(draft.approval_expires_at),
    executives: executives.length ? executives : undefined,
    consent: true,
  };
}
