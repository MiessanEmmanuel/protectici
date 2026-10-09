'use client';

import { useState, type ReactNode } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormError, FormSuccess } from '../ui/Field';
import { LoadingBlock } from '../ui/Spinner';

/**
 * Exige un compte connecté (et, par défaut, un e-mail vérifié) avant d'afficher `children`.
 * Confort UX : l'API refait toujours le contrôle (security.md §13).
 */
export function RequireAuth({
  redirectTo,
  intro,
  children,
}: {
  /** Chemin interne où revenir après connexion. */
  redirectTo: string;
  intro: string;
  children: ReactNode;
}) {
  const { user, status, refresh } = useSession();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return <LoadingBlock label="Vérification de votre session…" />;

  if (status === 'anonymous' || !user) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-bold">Connexion requise</h2>
        <p className="mt-2 text-muted">{intro}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <ButtonLink href={buildHref('/connexion', { redirect: redirectTo })}>Se connecter</ButtonLink>
          <ButtonLink href="/inscription" variant="secondary">
            Créer un compte
          </ButtonLink>
        </div>
        <p className="mt-3 text-sm text-muted">
          Après la connexion, vous reviendrez à cette page.
        </p>
      </Card>
    );
  }

  if (!user.email_verified) {
    return (
      <Card className="mx-auto max-w-xl border-accent-text bg-warning-soft">
        <h2 className="text-xl font-bold">Adresse e-mail à vérifier</h2>
        <p className="mt-2">
          Pour des raisons de sécurité, vous devez confirmer votre adresse e-mail avant de continuer.
          Un lien de confirmation vous a été envoyé lors de la création de votre compte.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <FormError message={error} />
          <FormSuccess message={sent ? 'E-mail de vérification envoyé.' : null} />
          <div>
            <Button
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await clientApi.resendVerification();
                  setSent(true);
                  await refresh();
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Renvoyer l’e-mail de vérification
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
