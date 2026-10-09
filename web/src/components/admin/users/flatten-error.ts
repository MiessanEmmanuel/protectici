import { ApiError } from '@/lib/api/errors';

/**
 * Les erreurs 422 portant sur des champs que la boîte de confirmation n'affiche pas (rôle,
 * activation, « dernier admin »…) sont ramenées à un message global, affiché sans fermer la boîte.
 * Les champs `keep` (motif, saisie de confirmation) restent des erreurs par champ.
 */
export function flattenError(error: unknown, keep: readonly string[] = []): unknown {
  if (!(error instanceof ApiError) || error.status !== 422) return error;
  const entries = Object.entries(error.errors);
  if (entries.some(([field]) => keep.includes(field))) return error;
  const first = entries[0]?.[1][0];
  return new ApiError(422, first ?? error.message);
}
