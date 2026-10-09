'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { pluralize } from '@/lib/format';
import { formatDate } from '@/lib/format';
import { TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { StatusBadge } from '../ui/StatusBadge';

export function MyEstablishmentsList() {
  const [page, setPage] = useState(1);
  const state = useResource(() => clientApi.listMyEstablishments(page), [page]);
  return (
    <QueryBoundary state={state} loadingLabel="Chargement de vos établissements…">
      {(res) =>
        res.data.length === 0 ? (
          <EmptyState
            title="Vous n’avez encore inscrit aucun établissement"
            action={<ButtonLink href="/inscription-etablissement">Inscrire mon établissement</ButtonLink>}
          >
            Inscrivez votre entreprise de sécurité ou votre structure pour apparaître dans l’annuaire.
          </EmptyState>
        ) : (
          <div>
            <ul className="flex flex-col gap-4" aria-label="Mes établissements">
              {res.data.map((e) => (
                <li key={`${e.type}-${e.slug}`}>
                  <Card as="article" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">{e.name}</h2>
                        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span>{TYPE_LABELS[e.type]}</span>
                          <StatusBadge status={e.status} />
                          <span>Envoyée le {formatDate(e.submitted_at)}</span>
                        </p>
                      </div>
                      <ButtonLink
                        href={`/espace-prestataire/${e.type}/${e.slug}`}
                        variant="secondary"
                        aria-label={`Gérer ${e.name}`}
                      >
                        Gérer
                      </ButtonLink>
                    </div>
                    {e.rejection_reason ? (
                      <p className="rounded-md border border-danger bg-danger-soft p-3 text-danger">
                        <span className="font-semibold">Motif du rejet : </span>
                        {e.rejection_reason}
                      </p>
                    ) : null}
                    {e.pending_change_requests > 0 ? (
                      <p className="text-sm">
                        Demandes de modification en attente : <strong>{e.pending_change_requests}</strong>{' '}
                        {pluralize(e.pending_change_requests, 'demande', 'demandes')}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
            <PagerButtons meta={res.meta} onPage={setPage} />
          </div>
        )
      }
    </QueryBoundary>
  );
}
