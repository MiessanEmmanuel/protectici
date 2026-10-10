import { ApiError } from '@/lib/api/errors';

interface ModerationOptions {
  /** Message affiché quand l'élément a déjà été traité (409) ou rejoué. */
  conflict: string;
  /** Message affiché quand l'élément n'existe plus (404). */
  notFound: string;
  /** Message de succès. */
  success: string;
  /** Annonce (région live + notification). */
  notify: (message: string) => void;
  /** Recharge la liste. */
  reload: () => void;
}

/**
 * Exécute une action de modération idempotente : un 409 (rejeu ou traitement concurrent) est
 * traité comme un état déjà atteint — la liste est rechargée sans erreur ; un 404 devient un
 * message clair. Les autres erreurs (403, 422, 429…) sont relancées pour être affichées.
 */
export async function moderate(action: () => Promise<unknown>, o: ModerationOptions): Promise<void> {
  try {
    await action();
    o.notify(o.success);
    o.reload();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      o.notify(o.conflict);
      o.reload();
      return;
    }
    if (e instanceof ApiError && e.status === 404) {
      o.reload();
      throw new ApiError(404, o.notFound);
    }
    throw e;
  }
}
