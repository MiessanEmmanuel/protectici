'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';
import { Badge } from '../ui/Tag';

/**
 * Garde d'accès /admin — confort UX uniquement : chaque appel d'administration est de toute façon
 * autorisé (ou refusé) par l'API Laravel (Policies), jamais par ce composant.
 */
export function AdminGuard() {
  const router = useRouter();
  const { user, status } = useSession();

  useEffect(() => {
    if (status === 'anonymous') router.replace(buildHref('/connexion', { redirect: '/admin' }));
  }, [status, router]);

  if (status !== 'authenticated' || !user)
    return <LoadingBlock label="Vérification de vos droits…" />;

  if (user.role !== 'admin' && user.role !== 'editor') {
    return (
      <ErrorState
        title="Accès refusé"
        action={
          <ButtonLink href="/" variant="secondary">
            Retour à l’accueil
          </ButtonLink>
        }
      >
        Cette zone est réservée à l’équipe d’administration.
      </ErrorState>
    );
  }

  if (!user.two_factor_enabled) {
    return (
      <ErrorState
        title="Vérification en deux étapes requise"
        action={<ButtonLink href="/compte">Activer la 2FA</ButtonLink>}
      >
        Pour accéder à l’administration, activez d’abord la vérification en deux étapes sur votre
        compte.
      </ErrorState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-xl font-bold">Bienvenue, {user.first_name}</h2>
        <p className="mt-1 text-muted">
          Rôle :{' '}
          <Badge tone="success">{user.role === 'admin' ? 'Administrateur' : 'Éditeur'}</Badge>
        </p>
        <p className="mt-3">
          L’accès a été vérifié. Les modules d’administration (modération, référentiels, blog)
          arriveront dans les phases suivantes.
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Contrôle d’accès</h2>
        <p className="mt-1 text-sm text-muted">
          Cette page ne fait que contrôler votre session. Les autorisations réelles sont vérifiées
          par l’API à chaque requête.
        </p>
      </Card>
    </div>
  );
}
