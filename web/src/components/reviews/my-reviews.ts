import { clientApi } from '@/lib/api/client';
import type { MyReview } from '@/lib/api/types';

/** Pages de /me/reviews parcourues au maximum (l'API ne filtre pas par fiche). */
const MAX_PAGES = 5;

let cache: { userId: number | undefined; promise: Promise<MyReview[]> } | null = null;

async function fetchMyReviews(): Promise<MyReview[]> {
  const out: MyReview[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await clientApi.listMyReviews(page);
    out.push(...res.data);
    if (page >= res.meta.last_page) break;
  }
  return out;
}

/**
 * Avis de l'utilisateur connecté, chargés une seule fois par page pour tous les composants
 * (formulaire d'avis, boutons « Signaler » de la liste). Un échec vide le cache.
 */
export function loadMyReviews(userId: number | undefined): Promise<MyReview[]> {
  if (cache && cache.userId === userId) return cache.promise;
  const promise = fetchMyReviews();
  cache = { userId, promise };
  promise.catch(() => {
    if (cache?.promise === promise) cache = null;
  });
  return promise;
}

/** À appeler après la création d'un avis (et dans les tests). */
export function invalidateMyReviews(): void {
  cache = null;
}
