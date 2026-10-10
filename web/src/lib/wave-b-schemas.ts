import { z } from 'zod';

/**
 * Schémas Zod de la vague B (UX uniquement : le serveur reste l'autorité). Les identifiants et
 * montants arrivent en chaîne depuis les champs de formulaire et ressortent en nombres.
 * Bornes alignées sur docs/api-contract.md §8.
 */

const required = (label: string) =>
  z
    .string({ error: `${label} est requis.` })
    .trim()
    .min(1, { error: `${label} est requis.` });

const email = z
  .string({ error: "L'adresse e-mail est requise." })
  .trim()
  .min(1, { error: "L'adresse e-mail est requise." })
  .max(255, { error: "L'adresse e-mail est trop longue." })
  .pipe(z.email({ error: "L'adresse e-mail n'est pas valide." }));

const phoneFormat = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .-]{8,20}$/, { error: "Le numéro de téléphone n'est pas valide." });
const optionalPhone = z.union([z.literal(''), phoneFormat]).optional();

const idString = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^\d+$/, { error: message })
    .transform((v) => Number(v));
const optionalId = z
  .union([z.literal(''), z.string().trim().regex(/^\d+$/)])
  .optional()
  .transform((v) => (v ? Number(v) : null));

const textBetween = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} est requis.` })
    .trim()
    .min(min, { error: `${label} doit comporter au moins ${min} caractères.` })
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` });

const consentLiteral = (message: string) => z.literal(true, { error: message });

/* ---------- Dis-moi tout (§8.2) ---------- */

export const FEEDBACK_COMMENT_MAX = 3000;

export const feedbackStep1Schema = z.object({
  civility: z.union([z.literal(''), z.enum(['M.', 'Mme', 'Mlle'])]).optional(),
  last_name: required('Le nom').max(100, { error: 'Le nom est trop long.' }),
  first_name: required('Le prénom').max(100, { error: 'Le prénom est trop long.' }),
  email,
  phone: optionalPhone,
});

export const feedbackStep2Schema = z.object({
  provider_slug: z.string().trim().max(190).optional(),
});

export const feedbackStep3Schema = z.object({
  action_type: z.enum(['encouragement', 'question', 'complaint', 'suggestion'], {
    error: 'Choisissez ce que vous désirez faire.',
  }),
});

export const feedbackStep4Schema = z
  .object({
    target_type: z.enum(['employee', 'product', 'service'], {
      error: 'Précisez l’objet de votre message.',
    }),
    service_type_id: optionalId,
    topic_id: optionalId,
    product_type: z.string().trim().max(150, { error: 'Le produit est trop long.' }).optional(),
    location: z.string().trim().max(190, { error: 'Le lieu est trop long.' }).optional(),
    comment: textBetween('Le commentaire', 10, FEEDBACK_COMMENT_MAX),
  })
  .superRefine((v, ctx) => {
    if (v.target_type === 'service' && !v.service_type_id) {
      ctx.addIssue({ code: 'custom', path: ['service_type_id'], message: 'Choisissez le type de prestation.' });
    }
    if (v.target_type !== 'product' && !v.topic_id) {
      ctx.addIssue({ code: 'custom', path: ['topic_id'], message: 'Choisissez le sujet concerné.' });
    }
  });

export const feedbackStep5Schema = z.object({
  consent: consentLiteral('Vous devez accepter le traitement de vos informations pour envoyer ce message.'),
});

export const feedbackTrackSchema = z.object({
  reference: z
    .string({ error: 'La référence est requise.' })
    .trim()
    .min(1, { error: 'La référence est requise.' })
    .max(40, { error: 'La référence est trop longue.' })
    .transform((v) => v.toUpperCase()),
  email,
});

/* ---------- Devis (§8.3) ---------- */

export const QUOTE_MAX_PROVIDERS = 5;

export const quoteSchema = z.object({
  first_name: required('Le prénom').max(100, { error: 'Le prénom est trop long.' }),
  last_name: required('Le nom').max(100, { error: 'Le nom est trop long.' }),
  email,
  phone: required('Le téléphone').pipe(phoneFormat),
  company_name: z.string().trim().max(190, { error: 'Le nom de l’entreprise est trop long.' }).optional(),
  service_type_id: idString('Choisissez un service.'),
  city_id: idString('Choisissez une ville.'),
  district_id: optionalId,
  description: textBetween('La description', 20, 3000),
  desired_start_date: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), { error: 'La date n’est pas valide.' })
    .refine((v) => !v || v >= todayIso(), { error: 'La date souhaitée ne peut pas être passée.' }),
  budget_range: z.string().trim().max(50, { error: 'Le budget est trop long (50 caractères).' }).optional(),
  provider_slugs: z
    .array(z.string())
    .max(QUOTE_MAX_PROVIDERS, { error: `Vous pouvez choisir ${QUOTE_MAX_PROVIDERS} prestataires au maximum.` })
    .optional(),
  consent: consentLiteral('Vous devez accepter le traitement de vos informations pour envoyer votre demande.'),
});

/** Date du jour au format AAAA-MM-JJ (fuseau local). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ---------- Contact (§8.4) ---------- */

export const contactSchema = z.object({
  name: required('Le nom').max(150, { error: 'Le nom est trop long.' }),
  email,
  subject: required('L’objet').max(200, { error: 'L’objet ne doit pas dépasser 200 caractères.' }),
  message: textBetween('Le message', 10, 5000),
  consent: consentLiteral('Vous devez accepter le traitement de vos informations pour envoyer votre message.'),
});

/* ---------- Avis (§8.1) ---------- */

export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 3000;
export const REVIEW_TITLE_MAX = 150;

export const reviewSchema = z.object({
  rating: z
    .number({ error: 'Choisissez une note de 1 à 5.' })
    .int({ error: 'Choisissez une note de 1 à 5.' })
    .min(1, { error: 'Choisissez une note de 1 à 5.' })
    .max(5, { error: 'Choisissez une note de 1 à 5.' }),
  title: z.string().trim().max(REVIEW_TITLE_MAX, { error: `Le titre ne doit pas dépasser ${REVIEW_TITLE_MAX} caractères.` }).optional(),
  body: textBetween('Votre avis', REVIEW_BODY_MIN, REVIEW_BODY_MAX),
});

export const reviewReportSchema = z.object({
  reason: z.enum(['spam', 'offensive', 'false_info', 'other'], { error: 'Choisissez une raison.' }),
  details: z.string().trim().max(1000, { error: 'Les précisions sont trop longues.' }).optional(),
});

export const REVIEW_REPLY_MIN = 5;
export const REVIEW_REPLY_MAX = 1500;
export const reviewReplySchema = z.object({
  body: textBetween('La réponse', REVIEW_REPLY_MIN, REVIEW_REPLY_MAX),
});

/* ---------- Devis reçus / admin ---------- */

export const quoteReplySchema = z.object({
  message: textBetween('Le message', 10, 3000),
  quoted_amount: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v.replace(/[\s  ]/g, '')), {
      error: 'Le montant doit être un nombre entier de FCFA.',
    })
    .transform((v) => (v ? Number(v.replace(/[\s  ]/g, '')) : null)),
});

export const REJECT_REASON_MIN = 10;
export const rejectReasonSchema = z.object({
  reason: textBetween('Le motif', REJECT_REASON_MIN, 1000),
});

export const adminReplySchema = z.object({
  body: textBetween('La réponse', 5, 5000),
  is_internal: z.boolean().optional(),
});
