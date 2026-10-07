import { z } from 'zod';

/**
 * Validation côté client (UX uniquement) : le serveur reste l'autorité (security.md §1, §14).
 * Messages en français.
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

const password = (min: number) =>
  z
    .string({ error: 'Le mot de passe est requis.' })
    .min(min, { error: `Le mot de passe doit contenir au moins ${min} caractères.` })
    .max(128, { error: 'Le mot de passe est trop long.' });

/** Téléphone ivoirien ou international : 8 à 15 chiffres, +, espaces, points, tirets tolérés. */
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .-]{8,20}$/, { error: "Le numéro de téléphone n'est pas valide." });

export const PASSWORD_MIN_USER = 10;

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'Le mot de passe est requis.' })
    .min(1, { error: 'Le mot de passe est requis.' }),
  remember: z.boolean().optional(),
});

export const twoFactorSchema = z
  .object({
    code: z.string().trim().optional(),
    recovery_code: z.string().trim().optional(),
  })
  .refine((v) => Boolean(v.code) || Boolean(v.recovery_code), {
    path: ['code'],
    error: 'Saisissez le code à 6 chiffres ou un code de secours.',
  })
  .refine((v) => !v.code || /^\d{6}$/.test(v.code), {
    path: ['code'],
    error: 'Le code doit comporter 6 chiffres.',
  });

export const registerSchema = z
  .object({
    first_name: required('Le prénom').max(100, { error: 'Le prénom est trop long.' }),
    last_name: required('Le nom').max(100, { error: 'Le nom est trop long.' }),
    email,
    phone: z.union([z.literal(''), phone]).optional(),
    password: password(PASSWORD_MIN_USER),
    password_confirmation: z
      .string({ error: 'La confirmation est requise.' })
      .min(1, { error: 'La confirmation est requise.' }),
    consent: z.literal(true, { error: 'Vous devez accepter les conditions pour créer un compte.' }),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    error: 'Les deux mots de passe ne sont pas identiques.',
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: required('Le lien de réinitialisation'),
    email,
    password: password(PASSWORD_MIN_USER),
    password_confirmation: z.string().min(1, { error: 'La confirmation est requise.' }),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    error: 'Les deux mots de passe ne sont pas identiques.',
  });

export const profileSchema = z.object({
  first_name: required('Le prénom').max(100, { error: 'Le prénom est trop long.' }),
  last_name: required('Le nom').max(100, { error: 'Le nom est trop long.' }),
  phone: z.union([z.literal(''), phone]).optional(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, { error: 'Le mot de passe actuel est requis.' }),
    password: password(PASSWORD_MIN_USER),
    password_confirmation: z.string().min(1, { error: 'La confirmation est requise.' }),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    error: 'Les deux mots de passe ne sont pas identiques.',
  });

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: 'Le code doit comporter 6 chiffres.' }),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, { error: 'Le mot de passe est requis.' }),
});

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Valide et renvoie une erreur (la première) par champ. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Récupère les champs texte d'un formulaire en objet (cases à cocher => booléen). */
export function formToObject(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const el of Array.from(form.elements)) {
    if (!(
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ))
      continue;
    if (!el.name) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}
