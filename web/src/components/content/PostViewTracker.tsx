'use client';

import { useEffect } from 'react';
import { clientApi } from '@/lib/api/client';

/**
 * Compteur de vues d'un article : appel navigateur unique par affichage (l'IP comptée est celle du
 * visiteur, pas celle du rendu serveur) ; l'échec est silencieux.
 */
export function PostViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    clientApi.trackPostView(slug).catch(() => undefined);
  }, [slug]);
  return null;
}
