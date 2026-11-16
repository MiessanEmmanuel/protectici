'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { FeedbackStatus, MyFeedback } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import {
  FEEDBACK_ACTION_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TARGET_LABELS,
} from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';

const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'forwarded', 'resolved', 'closed'];

/** Explication du statut, du point de vue de l'auteur du dossier. */
const STATUS_HELP: Record<FeedbackStatus, string> = {
  new: 'Votre message a été reçu. Notre équipe va le prendre en charge.',
  in_progress: 'Notre équipe traite votre dossier.',
  forwarded: 'Votre dossier a été transmis au prestataire concerné.',
  resolved: 'Votre dossier est résolu.',
  closed: 'Ce dossier est clôturé.',
};

/** « Le libellé » → « le libellé », pour l'insérer dans une phrase. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function title(f: MyFeedback): string {
  const what = `${FEEDBACK_ACTION_LABELS[f.action_type]} sur ${lower(FEEDBACK_TARGET_LABELS[f.target_type])}`;
  return f.topic ? `${what} · ${f.topic.name}` : what;
}

/** « Mes dossiers Dis-moi tout » : suivi des dossiers envoyés en étant connecté. */
export function MyFeedbacksView() {
  const [status, setStatus] = useState<'' | FeedbackStatus>('');
  const [page, setPage] = useState(1);
  const state = useResource(
    () => clientApi.listMyFeedbacks({ status: status || undefined, page }),
    [status, page],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | FeedbackStatus);
            setPage(1);
          }}
        >
          <option value="">Tous</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {FEEDBACK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <QueryBoundary state={state} loadingLabel="Chargement de vos dossiers…">
        {(list) => (
          <>
            {list.data.length === 0 ? (
              status ? (
                <EmptyState title="Aucun dossier">
                  Aucun dossier ne correspond à ce filtre.
                </EmptyState>
              ) : (
                <EmptyState
                  title="Vous n’avez pas encore de dossier « Dis-moi tout »"
                  action={<ButtonLink href="/dis-moi-tout">Envoyer un message</ButtonLink>}
                >
                  Les messages envoyés en étant connecté à votre compte apparaissent ici, avec les
                  réponses de notre équipe. Pour un message envoyé sans compte, utilisez la{' '}
                  <Link href="/dis-moi-tout/suivi">page de suivi</Link> avec votre référence.
                </EmptyState>
              )
            ) : (
              <ul className="flex flex-col gap-4">
                {list.data.map((f) => (
                  <li key={f.id}>
                    <Card as="article" aria-labelledby={`dossier-${f.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 id={`dossier-${f.id}`} className="text-lg font-extrabold">
                            {title(f)}
                          </h3>
                          <p className="text-sm text-muted">
                            Référence <strong className="text-ink">{f.reference}</strong> · envoyé
                            le <time dateTime={f.created_at}>{formatDate(f.created_at)}</time>
                            {f.provider ? (
                              <>
                                {' · '}
                                <Link href={`/annuaire/${encodeURIComponent(f.provider.slug)}`}>
                                  {f.provider.name}
                                </Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <StatusPill kind="feedback" status={f.status} />
                      </div>
                      <p className="mt-2 text-sm">{STATUS_HELP[f.status]}</p>
                      {f.comment || f.has_voice ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer font-semibold">Votre message</summary>
                          {f.comment ? (
                            <p className="mt-2 whitespace-pre-line">{f.comment}</p>
                          ) : null}
                          {f.has_voice ? (
                            <p className="mt-2 text-sm text-muted">Message vocal joint.</p>
                          ) : null}
                        </details>
                      ) : null}
                      {f.replies.length > 0 ? (
                        <div className="mt-4">
                          <h4 className="font-bold">Réponses de l’équipe ProtectIci</h4>
                          <ul className="mt-2 flex flex-col gap-2">
                            {f.replies.map((r, i) => (
                              <li key={i} className="bg-c4 p-3 text-sm">
                                <p className="font-semibold">
                                  <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
                                </p>
                                <p className="mt-1 whitespace-pre-line">{r.body}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            <PagerButtons meta={list.meta} onPage={setPage} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
