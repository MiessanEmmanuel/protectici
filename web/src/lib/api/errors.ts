/** Erreur uniforme levée par le client API (contrat §1). Jamais de détail technique. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly retryAfter: number | null;
  /** Code machine optionnel du corps d'erreur (ex. "email_unverified"). */
  readonly code: string | null;

  constructor(
    status: number,
    message: string,
    errors: Record<string, string[]> = {},
    retryAfter: number | null = null,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
    this.code = code;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export const GENERIC_MESSAGES: Record<number, string> = {
  0: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  401: 'Vous devez être connecté pour effectuer cette action.',
  403: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  404: 'Cette page ou cette ressource est introuvable.',
  419: 'Votre session a expiré. Rechargez la page et réessayez.',
  422: 'Certaines informations sont invalides. Corrigez les champs signalés.',
  429: 'Trop de tentatives. Patientez un instant avant de réessayer.',
  500: 'Une erreur est survenue. Réessayez dans quelques instants.',
};

export function genericMessage(status: number): string {
  return GENERIC_MESSAGES[status] ?? GENERIC_MESSAGES[500]!;
}

/** Premier message par champ (pour l'affichage sous chaque champ). */
export function firstFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.errors)) {
    const first = messages[0];
    if (first) out[field] = first;
  }
  return out;
}

/** Message affichable pour n'importe quelle erreur (jamais de trace). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429 && error.retryAfter) {
      return `Trop de tentatives. Réessayez dans ${formatRetry(error.retryAfter)}.`;
    }
    return error.message || genericMessage(error.status);
  }
  return genericMessage(500);
}

function formatRetry(seconds: number): string {
  if (seconds < 90) return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export interface SubmitError {
  fields: Record<string, string>;
  form: string | null;
}

/** Traduit une erreur d'API en erreurs par champ (422) et/ou message global. */
export function describeError(error: unknown): SubmitError {
  if (error instanceof ApiError && error.status === 422) {
    const fields = firstFieldErrors(error);
    return { fields, form: Object.keys(fields).length ? null : error.message };
  }
  return { fields: {}, form: errorMessage(error) };
}
