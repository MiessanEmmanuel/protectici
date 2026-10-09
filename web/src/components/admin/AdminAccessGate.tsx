'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { ButtonLink } from '../ui/Button';
import { ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';

/**
 * Garde d'accès /admin — confort UX uniquement : chaque appel d'administration est de toute façon
 * autorisé (ou refusé) par l'API Laravel (Policies, rôle admin + 2FA), jamais par ce composant.
 * Le rôle `editor` n'a pas accès à l'administration des établissements (blog uniquement, plus tard).
 */
export function AdminAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Accès refusé"
          action={
            <ButtonLink href="/" variant="secondary">
              Retour à l’accueil
            </ButtonLink>
          }
        >
          Cette zone est réservée aux administrateurs.
        </ErrorState>
      </div>
    );
  }

  if (!user.two_factor_enabled) {
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
