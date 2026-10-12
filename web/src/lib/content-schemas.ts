import { z } from 'zod';

/**
 * Schémas Zod de la phase 4 (UX uniquement : le serveur reste l'autorité). Bornes alignées sur
 * docs/api-contract.md §9.
 */

const email = z
  .string({ error: "L'adresse e-mail est requise." })
  .trim()
  .min(1, { error: "L'adresse e-mail est requise." })
  .max(255, { error: "L'adresse e-mail est trop longue." })
  .pipe(z.email({ error: "L'adresse e-mail n'est pas valide." }));

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} est requis.` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} est requis.` : `${label} doit comporter au moins ${min} caractères.` })
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` });

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` })
    .optional()
    .transform((v) => (v ? v : null));

const httpUrl = z
  .string()
  .trim()
  .max(255, { error: "L'adresse est trop longue." })
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), {
    error: "L'adresse doit commencer par http:// ou https://.",
  })
  .optional()
  .transform((v) => (v ? v : null));

export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, {
    error: 'Votre accord est nécessaire pour recevoir la lettre d’information.',
  }),
});

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 2000;
export const commentSchema = z.object({
  body: text('Le commentaire', COMMENT_MIN, COMMENT_MAX),
});

export const POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;

export const postFormSchema = z
  .object({
    title: text('Le titre', 3, 160),
    category_id: z
      .string({ error: 'La catégorie est requise.' })
      .regex(/^\d+$/, { error: 'La catégorie est requise.' })
      .transform(Number),
    excerpt: optionalText('Le résumé', 300),
    body: z
      .string()
      .refine((v) => v.replace(/<[^>]+>/g, '').trim().length >= 10, {
        error: 'Le contenu doit comporter au moins 10 caractères.',
      }),
    status: z.enum(POST_STATUSES, { error: 'Le statut est requis.' }),
    published_at: z.string().optional(),
    is_featured: z.boolean(),
    is_flash: z.boolean(),
    seo_title: optionalText('Le titre SEO', 70),
    seo_description: optionalText('La description SEO', 160),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'scheduled' && !v.published_at) {
      ctx.addIssue({
        code: 'custom',
        path: ['published_at'],
        message: 'La date de publication est obligatoire pour une planification.',
      });
    }
  });

export const categoryFormSchema = z.object({
  name: text('Le nom', 2, 80),
  description: optionalText('La description', 300),
  sort_order: z
    .string()
    .regex(/^\d{1,4}$/, { error: "L'ordre doit être un nombre entier positif." })
    .transform(Number),
  is_visible: z.boolean(),
});

export const pageFormSchema = z.object({
  title: text('Le titre', 3, 160),
  body: z
    .string()
    .refine((v) => v.replace(/<[^>]+>/g, '').trim().length >= 10, {
      error: 'Le contenu doit comporter au moins 10 caractères.',
    }),
  seo_title: optionalText('Le titre SEO', 70),
  seo_description: optionalText('La description SEO', 160),
  is_visible: z.boolean(),
});

export const partnerFormSchema = z.object({
  type: z.enum(['partner', 'client'], { error: 'Le type est requis.' }),
  name: text('Le nom', 2, 120),
  website_url: httpUrl,
  description: optionalText('La description', 500),
  sort_order: z
    .string()
    .regex(/^\d{1,4}$/, { error: "L'ordre doit être un nombre entier positif." })
    .transform(Number),
  is_visible: z.boolean(),
});

/** Date/heure saisie (datetime-local, heure d'Abidjan = UTC) -> ISO 8601 UTC. */
export function localInputToIso(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace('.000Z', 'Z');
}

/** ISO 8601 UTC -> valeur d'un champ datetime-local. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
}
