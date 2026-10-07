'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormError, FormSuccess } from '../ui/Field';
import { Badge } from '../ui/Tag';
import { LoadingBlock } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { FavoritesSection } from './FavoritesSection';
import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';
import { TwoFactorSection } from './TwoFactorSection';

export function AccountView({ justVerified }: { justVerified: boolean }) {
  const router = useRouter();
  const { user, status, refresh } = useSession();
  const toast = useToast();
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') router.replace(buildHref('/connexion', { redirect: '/compte' }));
  }, [status, router]);

  useEffect(() => {
    if (justVerified && status === 'authenticated') void refresh();
  }, [justVerified, status, refresh]);

  if (status !== 'authenticated' || !user)
    return <LoadingBlock label="Chargement de votre compte…" />;

  async function resend() {
    setResending(true);
    setResendError(null);
    try {
      await clientApi.resendVerification();
      toast.show('E-mail de vérification envoyé.', 'success');
      await refresh();
    } catch (e) {
      setResendError(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {justVerified ? (
        <FormSuccess message="Adresse e-mail confirmée, vous êtes connecté." />
      ) : null}
      {!user.email_verified ? (
        <Card className="border-accent-text bg-warning-soft">
          <p className="font-semibold">Adresse e-mail non vérifiée</p>
          <p className="mt-1">
            Vérifiez votre adresse pour ajouter des favoris et publier des avis.
          </p>
          <FormError message={resendError} />
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => void resend()}
            loading={resending}
          >
            Renvoyer l’e-mail de vérification
          </Button>
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="profil">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="profil" className="text-xl font-bold">
            Mon profil
          </h2>
          <Badge tone="neutral">Rôle : {roleLabel(user.role)}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
        <div className="mt-4">
          <ProfileForm user={user} />
        </div>
      </Card>

      <Card as="section" aria-labelledby="mdp">
        <h2 id="mdp" className="text-xl font-bold">
          Changer mon mot de passe
        </h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      <Card as="section" aria-labelledby="deux-facteurs">
        <h2 id="deux-facteurs" className="text-xl font-bold">
          Vérification en deux étapes (2FA)
        </h2>
        <div className="mt-4">
          <TwoFactorSection user={user} />
        </div>
      </Card>

      <Card as="section" aria-labelledby="favoris">
        <h2 id="favoris" className="text-xl font-bold">
          Mes favoris
        </h2>
        <div className="mt-4">
          <FavoritesSection />
        </div>
      </Card>
    </div>
  );
}

function roleLabel(role: string) {
  return (
    { user: 'Utilisateur', provider: 'Prestataire', editor: 'Éditeur', admin: 'Administrateur' }[
      role
    ] ?? role
  );
}
