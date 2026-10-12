'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ButtonLink, Button } from '../ui/Button';
import { ErrorState } from '../ui/EmptyState';
import { FormSuccess } from '../ui/Field';
import { LoadingBlock } from '../ui/Spinner';

const INVALID = 'Ce lien est invalide ou a expiré. Vous pouvez vous réabonner depuis le pied de page du site.';
const TOKEN_MAX = 2048;

const valid = (t: string | undefined): t is string => !!t && t.length <= TOKEN_MAX;

/** Confirmation d'abonnement : le jeton signé de l'e-mail est transmis à l'API (aucun état local conservé). */
export function NewsletterConfirm({ token }: { token?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(valid(token) ? 'loading' : 'error');
  const started = useRef(false);

  useEffect(() => {
    if (!valid(token) || started.current) return;
    started.current = true;
    clientApi
      .confirmNewsletter(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'loading') return <LoadingBlock label="Confirmation de votre abonnement…" />;
  if (state === 'error') {
    return (
      <ErrorState title="Lien invalide" action={<ButtonLink href="/blog" variant="secondary">Lire le blog</ButtonLink>}>
        {INVALID}
      </ErrorState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FormSuccess message="Votre abonnement est confirmé. Merci et à bientôt dans votre boîte de réception." />
      <div><ButtonLink href="/blog">Lire les derniers articles</ButtonLink></div>
    </div>
  );
}

/** Désinscription : action explicite (POST) pour éviter qu'un aperçu de lien ne désabonne à l'insu de l'utilisateur. */
export function NewsletterUnsubscribe({ token }: { token?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>(valid(token) ? 'idle' : 'error');
  const running = useRef(false);

  async function submit() {
    if (!valid(token) || running.current) return;
    running.current = true;
    setState('busy');
    try {
      await clientApi.unsubscribeNewsletter(token);
      setState('ok');
    } catch {
      setState('error');
    } finally {
      running.current = false;
    }
  }

  if (state === 'error') {
    return <ErrorState title="Lien invalide">{INVALID}</ErrorState>;
  }
  if (state === 'ok') {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess message="Vous êtes désinscrit de la lettre d’information. Vous ne recevrez plus nos e-mails." />
        <div><ButtonLink href="/" variant="secondary">Retour à l’accueil</ButtonLink></div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p>Confirmez-vous vouloir ne plus recevoir la lettre d’information de ProtectIci ?</p>
      <div>
        <Button onClick={() => void submit()} loading={state === 'busy'}>
          Me désinscrire
        </Button>
      </div>
    </div>
  );
}
