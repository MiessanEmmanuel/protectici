'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { canAccessAdminPath } from '@/lib/admin-access';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { ButtonLink } from '../ui/Button';
import { ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';

/**
 * Garde d'accès /admin — confort UX uniquement : chaque appel d'administration est de toute façon
 * autorisé (ou refusé) par l'API Laravel (Policies, rôle admin + 2FA), jamais par ce composant.
 * Le rôle `editor` n'accède qu'aux écrans de contenu (blog, commentaires, catégories, pages) ; la 2FA n'est exigée que pour `admin`.
 */
export function AdminAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSession();

  useEffect(() => {
    if (status === 'anonymous') router.replace(buildHref('/connexion', { redirect: '/admin' }));
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="mx-auto w-full max-w-page px-4 sm:px-6">
        <LoadingBlock label="Vérification de vos droits…" />
      </div>
    );
  }

  if (!canAccessAdminPath(user.role, pathname)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Accès refusé"
          action={
            <ButtonLink href={user.role === 'editor' ? '/admin/blog' : '/'} variant="secondary">
              {user.role === 'editor' ? 'Aller à la gestion du blog' : 'Retour à l’accueil'}
            </ButtonLink>
          }
        >
          {user.role === 'editor'
            ? 'Cet écran est réservé aux administrateurs. Vous pouvez gérer le blog, les commentaires, les catégories et les pages.'
            : 'Cette zone est réservée aux administrateurs.'}
        </ErrorState>
      </div>
    );
  }

  if (user.role === 'admin' && !user.two_factor_enabled) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Vérification en deux étapes requise"
          action={<ButtonLink href="/compte">Activer la vérification en deux étapes</ButtonLink>}
        >
          Pour accéder à l’administration, activez d’abord la vérification en deux étapes sur votre
          compte.
        </ErrorState>
      </div>
    );
  }

  return <>{children}</>;
}
