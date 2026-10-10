'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type {
  AdminReviewReport,
  AdminReviewRow,
  ReviewReportStatus,
  ReviewStatus,
} from '@/lib/api/types';
import { formatDateTime, pluralize } from '@/lib/format';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, REVIEW_STATUS_LABELS } from '@/lib/labels';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusPill } from '../../ui/StatusPill';
import { Tabs } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';
import { moderate } from './moderation';

export type ReviewsTab = 'reviews' | 'reports';

export function AdminReviewsView({ initialTab = 'reviews' }: { initialTab?: ReviewsTab }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Avis et signalements</h1>
      <p className="text-muted">
        Un avis n’est publié qu’après votre validation. Les signalements des internautes sont traités
        ici : accepter un signalement masque l’avis.
      </p>
      <Tabs
        label="Avis et signalements"
        initial={initialTab}
        tabs={[
          { id: 'reviews', label: 'Avis à modérer', content: <ReviewsPanel /> },
          { id: 'reports', label: 'Signalements', content: <ReportsPanel /> },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Avis */

type ReviewDialog = { kind: 'reject' | 'delete'; row: AdminReviewRow };

function ReviewsPanel() {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ReviewDialog | null>(null);
  const [notice, setNotice] = useState('');
  const inflight = useRef(false);
  const action = useAsyncAction();
  const toast = useToast();
  const list = useResource(
    () => clientApi.adminListReviews({ status, ...(q ? { q } : {}), page }),
    [status, q, page],
  );

  function notify(message: string) {
    setNotice(message);
    toast.show(message, 'success');
  }
  const opts = (success: string) => ({
    success,
    conflict: 'Cet avis a déjà été traité : la liste a été actualisée.',
    notFound: 'Cet avis est introuvable : il a peut-être été supprimé.',
    notify,
    reload: list.reload,
  });

  async function approve(row: AdminReviewRow) {
    await action.run(() =>
      moderate(() => clientApi.adminReviewAction(row.id, 'approve'), opts('Avis approuvé et publié.')),
    );
  }

  async function confirm(reason?: string) {
    const current = dialog;
    if (!current || inflight.current) return;
    inflight.current = true;
    try {
      if (current.kind === 'reject') {
        await moderate(
          () => clientApi.adminReviewAction(current.row.id, 'reject', reason ?? ''),
          opts('Avis rejeté.'),
        );
      } else {
        await moderate(() => clientApi.adminDeleteReview(current.row.id), opts('Avis supprimé.'));
      }
    } finally {
      inflight.current = false;
    }
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
        <Select
          label="Statut des avis"
          value={status}
          wrapperClassName="sm:w-64"
          onChange={(e) => {
            setStatus(e.target.value as ReviewStatus);
            setPage(1);
          }}
        >
          {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
            <option key={s} value={s}>
              {REVIEW_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          label="Rechercher un avis"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          wrapperClassName="sm:flex-1"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      <FormError message={action.error?.form} />

      <QueryBoundary state={list} loadingLabel="Chargement des avis…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun avis">Aucun avis ne correspond à ce filtre.</EmptyState>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {res.data.map((row) => (
                  <li key={row.id}>
                    <Card as="article" aria-labelledby={`avis-${row.id}`} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id={`avis-${row.id}`} className="text-lg font-bold">
                            {row.provider.name}
                          </h2>
                          <p className="text-sm text-muted">
                            {row.author
                              ? `${row.author.name} (${row.author.email})`
                              : 'Auteur supprimé'}{' '}
                            · {formatDateTime(row.created_at)}
                          </p>
                        </div>
                        <StatusPill kind="review" status={row.status} />
                      </div>
                      <p className="font-semibold">
                        Note : {row.rating} sur 5{row.title ? ` · ${row.title}` : ''}
                      </p>
                      <p className="whitespace-pre-line break-words">{row.body}</p>
                      <p className="text-sm text-muted">
                        {row.reports_count > 0
                          ? `${row.reports_count} ${pluralize(row.reports_count, 'signalement', 'signalements')}`
                          : 'Aucun signalement'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {row.status !== 'approved' ? (
                          <Button
                            onClick={() => void approve(row)}
                            loading={action.busy}
                            disabled={action.busy}
                            aria-label={`Approuver l’avis de ${row.author?.name ?? 'un auteur supprimé'} sur ${row.provider.name}`}
                          >
                            Approuver
                          </Button>
                        ) : null}
                        {row.status !== 'rejected' ? (
                          <Button
                            variant="secondary"
                            disabled={action.busy}
                            onClick={() => setDialog({ kind: 'reject', row })}
                            aria-label={`Rejeter l’avis sur ${row.provider.name}`}
                          >
                            Rejeter
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          disabled={action.busy}
                          onClick={() => setDialog({ kind: 'delete', row })}
                          aria-label={`Supprimer l’avis sur ${row.provider.name}`}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>

      <ConfirmDialog
        open={dialog?.kind === 'reject'}
        onClose={() => setDialog(null)}
        title="Rejeter l’avis"
        confirmLabel="Rejeter l’avis"
        tone="danger"
        reasonLabel="Motif du rejet"
        minReason={10}
        onConfirm={confirm}
      >
        <p>
          Le motif sera communiqué à l’auteur de l’avis sur <strong>{dialog?.row.provider.name}</strong>{' '}
          par e-mail.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        title="Supprimer l’avis"
        confirmLabel="Supprimer l’avis"
        tone="danger"
        onConfirm={confirm}
      >
        <p>
          L’avis sur <strong>{dialog?.row.provider.name}</strong> sera supprimé et la note moyenne du
          prestataire recalculée. Cette action est journalisée.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/* ----------------------------------------------------------- Signalements */

type ReportDialog = { row: AdminReviewReport };

function ReportsPanel() {
  const [status, setStatus] = useState<ReviewReportStatus>('open');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ReportDialog | null>(null);
  const [notice, setNotice] = useState('');
  const inflight = useRef(false);
  const action = useAsyncAction();
  const toast = useToast();
  const list = useResource(() => clientApi.adminListReviewReports({ status, page }), [status, page]);

  function notify(message: string) {
    setNotice(message);
    toast.show(message, 'success');
  }
  const opts = (success: string) => ({
    success,
    conflict: 'Ce signalement a déjà été traité : la liste a été actualisée.',
    notFound: 'Ce signalement est introuvable : l’avis a peut-être été supprimé.',
    notify,
    reload: list.reload,
  });

  async function dismiss(row: AdminReviewReport) {
    await action.run(() =>
      moderate(() => clientApi.adminReviewReportAction(row.id, 'dismiss'), opts('Signalement rejeté.')),
    );
  }

  async function accept(): Promise<void> {
    const current = dialog;
    if (!current || inflight.current) return;
    inflight.current = true;
    try {
      await moderate(
        () => clientApi.adminReviewReportAction(current.row.id, 'accept'),
        opts('Signalement accepté : l’avis est masqué.'),
      );
    } finally {
      inflight.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Select
        label="Statut des signalements"
        value={status}
        wrapperClassName="max-w-xs"
        onChange={(e) => {
          setStatus(e.target.value as ReviewReportStatus);
          setPage(1);
        }}
      >
        {(Object.keys(REPORT_STATUS_LABELS) as ReviewReportStatus[]).map((s) => (
          <option key={s} value={s}>
            {REPORT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      <FormError message={action.error?.form} />

      <QueryBoundary state={list} loadingLabel="Chargement des signalements…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun signalement">
              Aucun signalement ne correspond à ce filtre.
            </EmptyState>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {res.data.map((row) => (
                  <li key={row.id}>
                    <Card as="article" aria-labelledby={`sig-${row.id}`} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id={`sig-${row.id}`} className="text-lg font-bold">
                            Avis sur {row.review.provider_name}
                          </h2>
                          <p className="text-sm text-muted">
                            Signalé par {row.reporter ? row.reporter.name : 'un compte supprimé'} le{' '}
                            {formatDateTime(row.created_at)}
                          </p>
                        </div>
                        <StatusPill kind="report" status={row.status} />
                      </div>
                      <blockquote className="border-l-4 border-line pl-3">
                        <p className="text-sm text-muted">Note : {row.review.rating} sur 5</p>
                        <p className="whitespace-pre-line break-words">{row.review.body_excerpt}</p>
                      </blockquote>
                      <p>
                        <span className="font-semibold">Raison : </span>
                        {REPORT_REASON_LABELS[row.reason] ?? row.reason}
                      </p>
                      {row.details ? (
                        <p className="whitespace-pre-line break-words">
                          <span className="font-semibold">Détails : </span>
                          {row.details}
                        </p>
                      ) : null}
                      {row.status === 'open' ? (
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="danger"
                            disabled={action.busy}
                            onClick={() => setDialog({ row })}
                            aria-label={`Accepter le signalement de l’avis sur ${row.review.provider_name}`}
                          >
                            Accepter
                          </Button>
                          <Button
                            variant="secondary"
                            loading={action.busy}
                            disabled={action.busy}
                            onClick={() => void dismiss(row)}
                            aria-label={`Rejeter le signalement de l’avis sur ${row.review.provider_name}`}
                          >
                            Rejeter
                          </Button>
                        </div>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>

      <ConfirmDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title="Accepter le signalement"
        confirmLabel="Accepter et masquer l’avis"
        tone="danger"
        onConfirm={accept}
      >
        <p>
          L’avis sur <strong>{dialog?.row.review.provider_name}</strong> sera masqué et marqué comme
          rejeté. Cette action est journalisée.
        </p>
      </ConfirmDialog>
    </div>
  );
}

