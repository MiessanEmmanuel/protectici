'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { buildHref } from '@/lib/search-params';
import { RequireAuth } from '../establishment/RequireAuth';
import { useSession } from '../layout/SessionProvider';
import { LoadingBlock } from '../ui/Spinner';

/** Redirige un visiteur non connecté vers /connexion, avec retour à `redirectTo` après connexion. */
export function useLoginRedirect(redirectTo: string): void {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === 'anonymous') router.replace(buildHref('/connexion', { redirect: redirectTo }));
  }, [status, router, redirectTo]);
}

/**
 * Garde commune des pages /compte/* (R32) : un visiteur est redirigé vers la connexion ; un compte
 * connecté passe ensuite par RequireAuth (e-mail vérifié exigé). Confort UX : l'API refait le contrôle.
 */
export function AccountGuard({
  redirectTo,
  intro,
  children,
}: {
  redirectTo: string;
  intro: string;
  children: ReactNode;
}) {
  const { status } = useSession();
  useLoginRedirect(redirectTo);
  if (status !== 'authenticated') return <LoadingBlock label="Vérification de votre session…" />;
  return (
    <RequireAuth redirectTo={redirectTo} intro={intro}>
      {children}
    </RequireAuth>
  );
}
