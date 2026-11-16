'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { useSession } from '../layout/SessionProvider';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormError, FormSuccess } from '../ui/Field';
import { Badge } from '../ui/Tag';
import { LoadingBlock } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { useLoginRedirect } from './AccountGuard';
import { FavoritesSection } from './FavoritesSection';
import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';
import { TwoFactorSection } from './TwoFactorSection';

export function AccountView({ justVerified }: { justVerified: boolean }) {
  const { user, status, refresh } = useSession();
  const toast = useToast();
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useLoginRedirect('/compte');

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
          <h2 id="profil" className="text-2xl heading-block">
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
        <h2 id="mdp" className="text-2xl heading-block">
          Changer mon mot de passe
        </h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      <Card as="section" aria-labelledby="deux-facteurs">
        <h2 id="deux-facteurs" className="text-2xl heading-block">
          Vérification en deux étapes (2FA)
        </h2>
        <div className="mt-4">
          <TwoFactorSection user={user} />
        </div>
      </Card>

      <Card as="section" aria-labelledby="etablissements">
        <h2 id="etablissements" className="text-2xl heading-block">
          Mes établissements
        </h2>
        <p className="mt-1 text-muted">
          Vous représentez une entreprise de sécurité ou une administration ? Inscrivez-la dans
          l’annuaire ou gérez vos fiches existantes.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/espace-prestataire" variant="secondary">
            Gérer mes fiches
          </ButtonLink>
          <ButtonLink href="/inscription-etablissement">Inscrire un établissement</ButtonLink>
        </div>
      </Card>

      <Card as="section" aria-labelledby="mes-avis">
        <h2 id="mes-avis" className="text-2xl heading-block">
          Mes avis
        </h2>
        <p className="mt-1 text-muted">
          Consultez, modifiez ou supprimez les avis que vous avez donnés aux prestataires.
        </p>
        <div className="mt-4">
          <ButtonLink href="/compte/mes-avis" variant="secondary">
            Voir mes avis
          </ButtonLink>
        </div>
      </Card>

      <Card as="section" aria-labelledby="mes-devis">
        <h2 id="mes-devis" className="text-2xl heading-block">
          Mes demandes de devis
        </h2>
        <p className="mt-1 text-muted">
          Suivez les demandes envoyées depuis votre compte et les réponses des prestataires.
        </p>
        <div className="mt-4">
          <ButtonLink href="/compte/mes-devis" variant="secondary">
            Suivre mes demandes
          </ButtonLink>
        </div>
      </Card>

      <Card as="section" aria-labelledby="mes-dis-moi-tout">
        <h2 id="mes-dis-moi-tout" className="text-2xl heading-block">
          Mes dossiers « Dis-moi tout »
        </h2>
        <p className="mt-1 text-muted">
          Suivez vos encouragements, questions, plaintes et suggestions, et les réponses de notre
          équipe.
        </p>
        <div className="mt-4">
          <ButtonLink href="/compte/mes-dis-moi-tout" variant="secondary">
            Suivre mes dossiers
          </ButtonLink>
        </div>
      </Card>

      <Card as="section" aria-labelledby="favoris">
        <h2 id="favoris" className="text-2xl heading-block">
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
