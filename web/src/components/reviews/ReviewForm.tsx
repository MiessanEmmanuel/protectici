'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { MyReview } from '@/lib/api/types';
import { REVIEW_STATUS_LABELS } from '@/lib/labels';
import { buildHref } from '@/lib/search-params';
import { useSession } from '../layout/SessionProvider';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormSuccess } from '../ui/Field';
import { LoadingBlock } from '../ui/Spinner';
import { invalidateMyReviews, loadMyReviews } from './my-reviews';
import { ReviewEditor } from './ReviewEditor';

type Outcome = 'success' | 'conflict' | null;

/** Zone « Donner votre avis » de la fiche prestataire (îlot client dans une page serveur). */
export function ReviewForm({ slug, providerName }: { slug: string; providerName: string }) {
  const { user, status } = useSession();
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Avis existant (R27) : `undefined` tant que la recherche n'a pas abouti.
  const [existing, setExisting] = useState<MyReview | null | undefined>(undefined);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const canReview = status === 'authenticated' && user?.email_verified === true;
  const userId = user?.id;

  useEffect(() => {
    if (!canReview) return;
    let active = true;
    loadMyReviews(userId)
      .then((list) => active && setExisting(list.find((r) => r.provider.slug === slug) ?? null))
      // En cas d'échec, on affiche le formulaire : l'API refusera un doublon (409).
      .catch(() => active && setExisting(null));
    return () => {
      active = false;
    };
  }, [canReview, userId, slug]);

  useEffect(() => {
    if (outcome) titleRef.current?.focus();
  }, [outcome]);

  const redirectTo = `/annuaire/${slug}`;

  return (
    <Card as="div" className="mt-6" aria-labelledby="donner-avis">
      <h3 id="donner-avis" ref={titleRef} tabIndex={-1} className="text-xl heading-block">
        Donner votre avis
      </h3>
      <div className="mt-3">
        {status === 'loading' ? (
          <LoadingBlock label="Vérification de votre session…" />
        ) : status === 'anonymous' || !user ? (
          <div>
            <p className="text-muted">
              Connectez-vous pour donner votre avis sur {providerName}. Votre avis sera publié après
              modération.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <ButtonLink href={buildHref('/connexion', { redirect: redirectTo })}>
                Se connecter
              </ButtonLink>
              <ButtonLink href="/inscription" variant="secondary">
                Créer un compte
              </ButtonLink>
            </div>
          </div>
        ) : !user.email_verified ? (
          <div>
            <p>
              Vérifiez votre adresse e-mail avant de publier un avis. Un lien de confirmation vous a
              été envoyé à la création de votre compte.
            </p>
            <ButtonLink href="/compte" variant="secondary" className="mt-3">
              Aller à mon compte
            </ButtonLink>
          </div>
        ) : existing === undefined && outcome === null ? (
          <LoadingBlock label="Recherche de votre avis…" />
        ) : existing && outcome === null ? (
          <div className="flex flex-col gap-3">
            <div role="status" className="bg-white-alt border-2 border-ink p-3">
              <p className="font-semibold">
                Votre avis ({existing.rating}/5) · {REVIEW_STATUS_LABELS[existing.status]}
              </p>
              {existing.title ? <p className="mt-1 font-semibold">{existing.title}</p> : null}
              <p className="mt-1 whitespace-pre-line">{existing.body}</p>
            </div>
            <div>
              <ButtonLink href="/compte/mes-avis" variant="secondary">
                Modifier mon avis
              </ButtonLink>
            </div>
          </div>
        ) : outcome === 'success' ? (
          <div className="flex flex-col gap-3">
            <FormSuccess message="Merci ! Votre avis sera publié après modération." />
            <div>
              <ButtonLink href="/compte/mes-avis" variant="secondary">
                Voir mon avis
              </ButtonLink>
            </div>
          </div>
        ) : outcome === 'conflict' ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="bg-white-alt border-2 border-ink p-3">
              Vous avez déjà donné un avis pour ce prestataire.
            </p>
            <div>
              <ButtonLink href="/compte/mes-avis" variant="secondary">
                Voir mon avis
              </ButtonLink>
            </div>
          </div>
        ) : (
          <ReviewEditor
            submitLabel="Envoyer mon avis"
            idPrefix="nouvel-avis"
            onSubmit={async (input) => {
              try {
                await clientApi.createReview(slug, input);
                invalidateMyReviews();
                setOutcome('success');
              } catch (e) {
                if (e instanceof ApiError && e.status === 409) {
                  setOutcome('conflict');
                  return;
                }
                if (e instanceof ApiError && e.status === 404) {
                  throw new ApiError(
                    404,
                    'Cette fiche n’est plus disponible : impossible d’y déposer un avis.',
                  );
                }
                throw e;
              }
            }}
          />
        )}
      </div>
    </Card>
  );
}
