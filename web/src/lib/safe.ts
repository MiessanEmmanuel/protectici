import { ApiError } from './api/errors';

/** Exécute un appel d'API et renvoie `[données, null]` ou `[null, erreur]` (404 relancé via `onNotFound`). */
export async function safe<T>(
  promise: Promise<T>,
  onNotFound?: () => never,
): Promise<[T, null] | [null, ApiError]> {
  try {
    return [await promise, null];
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404 && onNotFound) onNotFound();
      return [null, e];
    }
    return [null, new ApiError(500, 'Une erreur est survenue. Réessayez dans quelques instants.')];
  }
}
