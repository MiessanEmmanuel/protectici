'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

/** Favori : réservé aux comptes connectés (et e-mail vérifié, contrôlé par l'API). */
export function FavoriteButton({
  slug,
  name,
  initial,
}: {
  slug: string;
  name: string;
  initial: boolean | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSession();
  const toast = useToast();
  const [favorite, setFavorite] = useState<boolean>(initial ?? false);
  const [busy, setBusy] = useState(false);

  // Rendu serveur anonyme (initial === null) : on récupère l'état réel une fois la session connue.
  useEffect(() => {
    if (initial !== null || status !== 'authenticated') return;
    let active = true;
    clientApi
      .getProvider(slug)
      .then((p) => active && setFavorite(Boolean(p.is_favorite)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initial, status, slug]);

  async function toggle() {
    if (status !== 'authenticated' || !user) {
      router.push(buildHref('/connexion', { redirect: pathname }));
      return;
    }
    setBusy(true);
    try {
      if (favorite) {
        await clientApi.removeFavorite(slug);
        setFavorite(false);
        toast.show(`${name} a été retiré de vos favoris.`, 'success');
      } else {
        await clientApi.addFavorite(slug);
        setFavorite(true);
        toast.show(`${name} a été ajouté à vos favoris.`, 'success');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.push(buildHref('/connexion', { redirect: pathname }));
      else toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={() => void toggle()}
      loading={busy}
      aria-pressed={favorite}
    >
      <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
      {favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    </Button>
  );
}
