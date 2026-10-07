'use client';

import { useEffect } from 'react';
import { clientApi } from '@/lib/api/client';

/** Compteur de vues : un appel unique par affichage de fiche ; l'échec est silencieux. */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    clientApi.trackProviderView(slug).catch(() => undefined);
  }, [slug]);
  return null;
}
