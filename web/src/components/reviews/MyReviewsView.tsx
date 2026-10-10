'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { MyReview } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { FormSuccess } from '../ui/Field';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { RatingStars } from '../ui/RatingStars';
import { StatusPill } from '../ui/StatusPill';
import { ReviewEditor } from './ReviewEditor';

/** Page « Mes avis » : liste paginée, modification inline et suppression confirmée. */
export function MyReviewsView() {
  const [page, setPage] = useState(1);
  const state = useResource(() => clientApi.listMyReviews(page), [page]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<MyReview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function gone() {
    setEditingId(null);
    setDeleting(null);
    setNotice('Cet avis n’existe plus. La liste a été actualisée.');
    state.reload();
  }

  return (
    <QueryBoundary state={state} loadingLabel="Chargement de vos avis…">
      {(list) => (
        <div className="flex flex-col gap-4">
          <div role="status">{notice ? <FormSuccess message={notice} /> : null}</div>
          {list.data.length === 0 ? (
            <EmptyState
              title="Vous n’avez pas encore donné d’avis"
              action={<ButtonLink href="/annuaire">Parcourir l’annuaire</ButtonLink>}
            >
              Rendez-vous sur la fiche d’un prestataire pour partager votre expérience.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-4">
              {list.data.map((r) => (
                <li key={r.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/annuaire/${encodeURIComponent(r.provider.slug)}`}
                        className="font-semibold"
                      >
                        {r.provider.name}
                      </Link>
                      <StatusPill kind="review" status={r.status} />
                    </div>
                    {editingId === r.id ? (
                      <div className="mt-4">
                        <p className="mb-3 rounded-md border border-accent-text bg-warning-soft p-3 text-sm">
                          La modification remet l’avis en modération et le masque jusqu’à
                          validation.
                        </p>
                        <ReviewEditor
                          initial={r}
                          idPrefix={`avis-${r.id}`}
                          submitLabel="Enregistrer la modification"
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (input) => {
                            try {
                              const updated = await clientApi.updateMyReview(r.id, input);
                              state.setData({
                                ...list,
                                data: list.data.map((x) => (x.id === r.id ? updated : x)),
                              });
                              setEditingId(null);
                              setNotice(
                                'Avis modifié. Il est de nouveau en attente de modération.',
                              );
                            } catch (e) {
                              if (e instanceof ApiError && e.status === 404) {
                                gone();
                                return;
                              }
                              throw e;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <RatingStars value={r.rating} showValue={false} />
                          <span className="text-sm">{r.rating} sur 5</span>
                          <time dateTime={r.created_at} className="text-sm text-muted">
                            {formatDate(r.created_at)}
                          </time>
                        </div>
                        {r.title ? <h3 className="mt-2 font-semibold">{r.title}</h3> : null}
                        <p className="mt-1 whitespace-pre-line">{r.body}</p>
                        {r.status === 'rejected' && r.rejection_reason ? (
                          <p className="mt-3 rounded-md border border-danger bg-danger-soft p-3 text-sm">
                            <strong>Motif du rejet :</strong>{' '}
                            <span className="whitespace-pre-line">{r.rejection_reason}</span>
                          </p>
                        ) : null}
                        {r.provider_reply ? (
                          <div className="mt-3 rounded-md bg-surface-alt p-3 text-sm">
                            <p className="font-semibold">Réponse du prestataire</p>
                            <p className="mt-1 whitespace-pre-line">{r.provider_reply}</p>
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setNotice(null);
                              setEditingId(r.id);
                            }}
                          >
                            Modifier
                            <span className="sr-only"> l’avis sur {r.provider.name}</span>
                          </Button>
                          <Button variant="danger" onClick={() => setDeleting(r)}>
                            Supprimer
                            <span className="sr-only"> l’avis sur {r.provider.name}</span>
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <PagerButtons
            meta={list.meta}
            disabled={state.loading}
            onPage={(p) => {
              setNotice(null);
              setEditingId(null);
              setPage(p);
            }}
          />
          <ConfirmDialog
            open={deleting !== null}
            onClose={() => setDeleting(null)}
            title="Supprimer cet avis ?"
            confirmLabel="Supprimer l’avis"
            tone="danger"
            onConfirm={async () => {
              if (!deleting) return;
              try {
                await clientApi.deleteMyReview(deleting.id);
              } catch (e) {
                if (e instanceof ApiError && e.status === 404) {
                  gone();
                  return;
                }
                throw e;
              }
              setNotice('Avis supprimé.');
              if (list.data.length === 1 && page > 1) setPage(page - 1);
              else state.reload();
            }}
          >
            <p>
              Votre avis sur <strong>{deleting?.provider.name}</strong> sera supprimé et la note
              moyenne du prestataire recalculée.
            </p>
          </ConfirmDialog>
        </div>
      )}
    </QueryBoundary>
  );
}
