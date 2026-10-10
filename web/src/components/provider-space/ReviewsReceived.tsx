'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage, firstFieldErrors } from '@/lib/api/errors';
import type { MyEstablishmentSummary, OwnerReview, ReviewStatus } from '@/lib/api/types';
import { formatDate, pluralize } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { validate } from '@/lib/validation';
import { REVIEW_REPLY_MAX, REVIEW_REPLY_MIN, reviewReplySchema } from '@/lib/wave-b-schemas';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { FormError, FormSuccess } from '../ui/Field';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { RatingStars } from '../ui/RatingStars';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';
import { Textarea } from '../ui/Textarea';

const MAX_PAGES = 10;

/** Fiches prestataire validées du compte (toutes pages, borné). */
async function loadApprovedProviders(): Promise<MyEstablishmentSummary[]> {
  const out: MyEstablishmentSummary[] = [];
  let page = 1;
  for (;;) {
    const res = await clientApi.listMyEstablishments(page);
    out.push(...res.data);
    if (page >= res.meta.last_page || page >= MAX_PAGES) break;
    page += 1;
  }
  return out.filter((e) => e.type === 'provider' && e.status === 'approved');
}

export function ReviewsReceived() {
  const fiches = useResource(loadApprovedProviders, []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wanted = params.get('fiche') ?? '';

  return (
    <QueryBoundary state={fiches} loadingLabel="Chargement de vos fiches…">
      {(list) => {
        if (list.length === 0) {
          return (
            <EmptyState
              title="Aucune fiche prestataire validée"
              action={<ButtonLink href="/espace-prestataire">Voir mes établissements</ButtonLink>}
            >
              Les avis sont disponibles dès qu’une de vos fiches de prestataire est validée et publiée.
            </EmptyState>
          );
        }
        const selected = list.find((f) => f.slug === wanted)?.slug ?? (list.length === 1 ? list[0]!.slug : '');
        return (
          <div className="flex flex-col gap-6">
            <Select
              label="Fiche concernée"
              value={selected}
              onChange={(e) => {
                const v = e.target.value;
                router.replace(v ? `${pathname}?fiche=${encodeURIComponent(v)}` : pathname);
              }}
              wrapperClassName="max-w-md"
            >
              <option value="">Choisir une fiche</option>
              {list.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </Select>
            {selected ? (
              <ReviewList key={selected} slug={selected} />
            ) : (
              <p className="text-muted">Choisissez une fiche pour afficher ses avis.</p>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

const FILTERS: { value: '' | ReviewStatus; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'approved', label: 'Publiés' },
  { value: 'pending', label: 'En attente' },
  { value: 'rejected', label: 'Rejetés' },
];

function ReviewList({ slug }: { slug: string }) {
  const [status, setStatus] = useState<'' | ReviewStatus>('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const list = useResource(
    () => clientApi.listOwnerReviews(slug, { status: status || undefined, page }),
    [slug, status, page],
  );
  const counts = useResource(async () => {
    const [published, pending] = await Promise.all([
      clientApi.listOwnerReviews(slug, { status: 'approved' }),
      clientApi.listOwnerReviews(slug, { status: 'pending' }),
    ]);
    return { published: published.meta.total, pending: pending.meta.total };
  }, [slug]);

  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="text-xl font-bold">
            Avis de la fiche
          </h2>
          {counts.data ? (
            <p className="text-muted">
              {pluralize(counts.data.published, 'avis publié', 'avis publiés')} ·{' '}
              {counts.data.pending} en attente de modération
            </p>
          ) : null}
        </div>
        <Select
          label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | ReviewStatus);
            setPage(1);
          }}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <FormSuccess message={notice?.kind === 'ok' ? notice.text : null} />
      <FormError message={notice?.kind === 'error' ? notice.text : null} />
      <QueryBoundary state={list} loadingLabel="Chargement des avis…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun avis">Aucun avis ne correspond à ce filtre pour le moment.</EmptyState>
          ) : (
            <div>
              <ul className="flex flex-col gap-4" aria-label="Avis reçus">
                {res.data.map((r) => (
                  <li key={r.id}>
                    <ReviewItem
                      review={r}
                      slug={slug}
                      onNotice={setNotice}
                      onChanged={list.reload}
                    />
                  </li>
                ))}
              </ul>
              <PagerButtons meta={res.meta} onPage={setPage} />
            </div>
          )
        }
      </QueryBoundary>
    </section>
  );
}

function ReviewItem({
  review,
  slug,
  onNotice,
  onChanged,
}: {
  review: OwnerReview;
  slug: string;
  onNotice: (n: { kind: 'ok' | 'error'; text: string } | null) => void;
  onChanged: () => void;
}) {
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RatingStars value={review.rating} showValue={false} />
        <StatusPill kind="review" status={review.status} />
      </div>
      {review.title ? <h3 className="text-lg font-bold">{review.title}</h3> : null}
      <p className="whitespace-pre-line">{review.body}</p>
      <p className="text-sm text-muted">
        Par {review.author} · {formatDate(review.created_at)}
      </p>
      {review.provider_reply ? (
        <div className="ml-4 rounded-md border-l-4 border-primary bg-surface-alt p-3">
          <p className="text-sm font-semibold">
            Votre réponse
            {review.provider_replied_at ? ` · ${formatDate(review.provider_replied_at)}` : ''}
          </p>
          <p className="whitespace-pre-line">{review.provider_reply}</p>
        </div>
      ) : review.status === 'approved' ? (
        <ReplyForm review={review} slug={slug} onNotice={onNotice} onChanged={onChanged} />
      ) : null}
    </Card>
  );
}

function ReplyForm({
  review,
  slug,
  onNotice,
  onChanged,
}: {
  review: OwnerReview;
  slug: string;
  onNotice: (n: { kind: 'ok' | 'error'; text: string } | null) => void;
  onChanged: () => void;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<string | null>(null);
  const sending = useRef(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(reviewReplySchema, { body });
    if (!v.ok) {
      setError(v.errors.body);
      return;
    }
    setError(undefined);
    setConfirm(v.data.body);
  }

  async function send() {
    if (confirm === null || sending.current) return;
    sending.current = true;
    try {
      await clientApi.replyToReview(slug, review.id, confirm);
      onNotice({ kind: 'ok', text: 'Votre réponse a été publiée.' });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        onNotice({ kind: 'error', text: 'Vous avez déjà répondu à cet avis. La liste a été actualisée.' });
        onChanged();
      } else if (e instanceof ApiError && e.status === 404) {
        onNotice({ kind: 'error', text: 'Cet avis n’est plus disponible pour une réponse. La liste a été actualisée.' });
        onChanged();
      } else if (e instanceof ApiError && e.status === 422) {
        setError(firstFieldErrors(e).body ?? errorMessage(e));
      } else {
        throw e;
      }
    } finally {
      sending.current = false;
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Textarea
        label="Votre réponse"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={error}
        maxLength={REVIEW_REPLY_MAX}
        hint={`${REVIEW_REPLY_MIN} à ${REVIEW_REPLY_MAX} caractères (${body.trim().length}/${REVIEW_REPLY_MAX}). Une seule réponse est possible.`}
        rows={3}
      />
      <div>
        <Button type="submit" variant="secondary">
          Répondre à cet avis
        </Button>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Confirmer votre réponse"
        confirmLabel="Publier la réponse"
        onConfirm={send}
      >
        <p>Une seule réponse est possible et elle ne pourra plus être modifiée.</p>
        <p className="mt-2 whitespace-pre-line rounded-md bg-surface-alt p-3">{confirm}</p>
      </ConfirmDialog>
    </form>
  );
}
