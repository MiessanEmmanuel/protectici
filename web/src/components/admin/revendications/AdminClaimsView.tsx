'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CLAIM_STATUS_LABELS, claimsApi, type ClaimStatus } from '@/lib/api/claims';
import { formatDateTime } from '@/lib/format';
import { SUBMITTER_LABELS, TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { EmptyState } from '../../ui/EmptyState';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Tag';
import { AdminPageHeader } from '../AdminPageHeader';
import { filterPanelClasses, itemCardClasses } from '../etablissements/panel';

const FILTER_LABELS: Record<ClaimStatus, string> = {
  pending: 'En attente',
  approved: 'Acceptées',
  rejected: 'Refusées',
};

export function claimTone(status: ClaimStatus): 'success' | 'danger' | 'accent' {
  return status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'accent';
}

/** File des revendications de fiches (GET /admin/claims, contrat §10.3). */
export function AdminClaimsView() {
  const [status, setStatus] = useState<ClaimStatus>('pending');
  const [page, setPage] = useState(1);
  const list = useResource(() => claimsApi.adminListClaims({ status, page }), [status, page]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        section="Annuaire"
        title="Revendications"
        description="Demandes de comptes qui souhaitent gérer une fiche publiée sans propriétaire. Vérifiez le justificatif avant d’accepter."
      />
      <div className={`${filterPanelClasses} sm:grid-cols-[minmax(0,20rem)]`}>
        <Select
          label="Statut des revendications"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ClaimStatus);
            setPage(1);
          }}
        >
          {(Object.keys(FILTER_LABELS) as ClaimStatus[]).map((s) => (
            <option key={s} value={s}>
              {FILTER_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <QueryBoundary state={list} loadingLabel="Chargement des revendications…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucune revendication">
              Aucune revendication ne correspond à ce filtre.
            </EmptyState>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {res.data.map((c) => (
                  <li key={c.id}>
                    <article aria-labelledby={`claim-${c.id}`} className={itemCardClasses}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 id={`claim-${c.id}`} className="text-lg font-bold break-words">
                            <Link href={`/admin/revendications/${c.id}`}>
                              {c.establishment.name}
                            </Link>
                          </h2>
                          <p className="text-sm text-muted">
                            {TYPE_LABELS[c.establishment.type]} · {c.establishment.city.name} ·
                            demandée le {formatDateTime(c.created_at)}
                          </p>
                        </div>
                        <Badge tone={claimTone(c.status)}>{CLAIM_STATUS_LABELS[c.status]}</Badge>
                      </div>
                      <p className="break-words">
                        <span className="font-semibold">Demandeur :</span>{' '}
                        {c.user ? `${c.user.name} (${c.user.email})` : 'Compte supprimé'} ·{' '}
                        {SUBMITTER_LABELS[c.submitter_role]}
                      </p>
                      <div>
                        <Link
                          href={`/admin/revendications/${c.id}`}
                          className="font-bold underline"
                        >
                          {c.status === 'pending' ? 'Examiner la demande' : 'Voir le détail'}
                          <span className="sr-only"> pour {c.establishment.name}</span>
                        </Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
