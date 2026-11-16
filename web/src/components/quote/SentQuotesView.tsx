'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { QuoteStatus, SentQuote } from '@/lib/api/types';
import { formatDate, formatFcfa } from '@/lib/format';
import { QUOTE_STATUS_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';

const STATUSES: QuoteStatus[] = ['new', 'sent', 'answered', 'closed', 'cancelled'];

/** Explication du statut global, du point de vue du demandeur. */
const STATUS_HELP: Record<QuoteStatus, string> = {
  new: 'Notre équipe va transmettre votre demande aux prestataires adaptés.',
  sent: 'Votre demande a été transmise. Les prestataires vous répondront ici et par e-mail.',
  answered: 'Au moins un prestataire vous a répondu.',
  closed: 'Cette demande est clôturée.',
  cancelled: 'Cette demande a été annulée.',
};

function Recipients({ quote }: { quote: SentQuote }) {
  if (quote.recipients.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="font-bold">Prestataires contactés</h4>
      <ul className="mt-2 flex flex-col gap-3">
        {quote.recipients.map((r) => (
          <li key={r.provider.slug} className="border-t-2 border-ink pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/annuaire/${encodeURIComponent(r.provider.slug)}`}
                className="font-semibold"
              >
                {r.provider.name}
              </Link>
              <StatusPill kind="recipient" status={r.status} />
            </div>
            {r.status === 'replied' ? (
              <div className="mt-2 bg-c4 p-3 text-sm">
                <p className="font-semibold">
                  Réponse{r.replied_at ? ` du ${formatDate(r.replied_at)}` : ''}
                  {r.quoted_amount !== null ? ` · ${formatFcfa(r.quoted_amount)}` : ''}
                </p>
                {r.response_message ? (
                  <p className="mt-1 whitespace-pre-line">{r.response_message}</p>
                ) : null}
              </div>
            ) : null}
            {r.status === 'declined' ? (
              <p className="mt-2 text-sm text-muted">
                Ce prestataire ne donne pas suite
                {r.response_message ? ` : ${r.response_message}` : '.'}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** « Mes demandes de devis » : suivi des demandes envoyées en étant connecté. */
export function SentQuotesView() {
  const [status, setStatus] = useState<'' | QuoteStatus>('');
  const [page, setPage] = useState(1);
  const state = useResource(
    () => clientApi.listSentQuotes({ status: status || undefined, page }),
    [status, page],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | QuoteStatus);
            setPage(1);
          }}
        >
          <option value="">Toutes</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <QueryBoundary state={state} loadingLabel="Chargement de vos demandes de devis…">
        {(list) => (
          <>
            {list.data.length === 0 ? (
              status ? (
                <EmptyState title="Aucune demande">
                  Aucune demande de devis ne correspond à ce filtre.
                </EmptyState>
              ) : (
                <EmptyState
                  title="Vous n’avez pas encore de demande de devis"
                  action={<ButtonLink href="/devis">Demander un devis</ButtonLink>}
                >
                  Les demandes envoyées en étant connecté à votre compte apparaissent ici, avec les
                  réponses des prestataires.
                </EmptyState>
              )
            ) : (
              <ul className="flex flex-col gap-4">
                {list.data.map((q) => (
                  <li key={q.id}>
                    <Card as="article" aria-labelledby={`devis-${q.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 id={`devis-${q.id}`} className="text-lg font-extrabold">
                            {q.service.name} · {q.city.name}
                            {q.district ? `, ${q.district.name}` : ''}
                          </h3>
                          <p className="text-sm text-muted">
                            Référence <strong className="text-ink">{q.reference}</strong> · envoyée
                            le <time dateTime={q.created_at}>{formatDate(q.created_at)}</time>
                          </p>
                        </div>
                        <StatusPill kind="quote" status={q.status} />
                      </div>
                      <p className="mt-2 text-sm">{STATUS_HELP[q.status]}</p>
                      <details className="mt-3">
                        <summary className="cursor-pointer font-semibold">
                          Détail de la demande
                        </summary>
                        <p className="mt-2 whitespace-pre-line">{q.description}</p>
                        {q.desired_start_date || q.budget_range ? (
                          <p className="mt-2 text-sm text-muted">
                            {q.desired_start_date
                              ? `Début souhaité : ${formatDate(q.desired_start_date)}`
                              : ''}
                            {q.desired_start_date && q.budget_range ? ' · ' : ''}
                            {q.budget_range ? `Budget : ${q.budget_range}` : ''}
                          </p>
                        ) : null}
                      </details>
                      <Recipients quote={q} />
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
