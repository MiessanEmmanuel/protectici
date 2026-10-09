'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AdminChangeRequestRow } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { ChangeDiff } from './ChangeDiff';

type Status = 'pending' | 'approved' | 'rejected';

const STATUS_LABELS: Record<Status, string> = {
  pending: 'En attente',
  approved: 'Approuvées',
  rejected: 'Rejetées',
};
const STATUS_BADGES: Record<Status, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
};

interface Pending {
  kind: 'approve' | 'reject';
  row: AdminChangeRequestRow;
}

export function AdminChangeRequestsView() {
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [notice, setNotice] = useState('');
  const inflight = useRef(false);
  const toast = useToast();
  const list = useResource(() => clientApi.adminListChangeRequests({ status, page }), [status, page]);
  const reference = useResource(() => clientApi.getReferenceData(), []);

  async function confirm(reason?: string) {
    const current = dialog;
    if (!current || inflight.current) return;
    inflight.current = true;
    try {
      if (current.kind === 'approve') await clientApi.adminApproveChangeRequest(current.row.id);
      else await clientApi.adminRejectChangeRequest(current.row.id, reason ?? '');
      const msg = current.kind === 'approve' ? 'Demande approuvée.' : 'Demande rejetée.';
      setNotice(msg);
      toast.show(msg, 'success');
      list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Rejeu ou traitement concurrent : l'état est simplement rafraîchi.
        setNotice('Cette demande a déjà été traitée.');
        toast.show('Cette demande a déjà été traitée.', 'info');
        list.reload();
        return;
      }
      if (e instanceof ApiError && e.status === 404) {
        throw new ApiError(404, 'Cette demande est introuvable : elle a peut-être été supprimée.');
      }
      throw e;
    } finally {
      inflight.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Demandes de modification</h1>
      <p className="text-muted">
        Les champs sensibles d’une fiche (raison sociale, RCCM, agrément…) ne sont modifiés qu’après
        votre validation.
      </p>
      <Select
        label="Statut des demandes"
        value={status}
        wrapperClassName="max-w-xs"
        onChange={(e) => {
          setStatus(e.target.value as Status);
          setPage(1);
        }}
      >
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>

      <QueryBoundary state={list} loadingLabel="Chargement des demandes…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucune demande">
              Aucune demande de modification ne correspond à ce filtre.
            </EmptyState>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {res.data.map((row) => (
                  <li key={row.id}>
                    <Card as="article" aria-labelledby={`cr-${row.id}`} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id={`cr-${row.id}`} className="text-lg font-bold">
                            <Link href={`/admin/etablissements/${row.type}/${row.establishment.id}`}>
                              {row.establishment.name}
                            </Link>
                          </h2>
                          <p className="text-sm text-muted">
                            {TYPE_LABELS[row.type]} · demandée le {formatDateTime(row.created_at)}
                          </p>
                        </div>
                        <Badge tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'accent'}>
                          {STATUS_BADGES[row.status]}
                        </Badge>
                      </div>
                      <ChangeDiff changes={row.changes} reference={reference.data} />
                      {row.status === 'pending' ? (
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={() => setDialog({ kind: 'approve', row })}>Approuver</Button>
                          <Button variant="secondary" onClick={() => setDialog({ kind: 'reject', row })}>
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
        open={dialog?.kind === 'approve'}
        onClose={() => setDialog(null)}
        title="Approuver la demande"
        confirmLabel="Approuver"
        onConfirm={confirm}
      >
        <p>
          Les modifications seront appliquées à la fiche{' '}
          <strong>{dialog?.row.establishment.name}</strong> et son propriétaire sera prévenu par e-mail.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.kind === 'reject'}
        onClose={() => setDialog(null)}
        title="Rejeter la demande"
        confirmLabel="Rejeter"
        tone="danger"
        reasonLabel="Motif du rejet"
        onConfirm={confirm}
      >
        <p>
          Le motif sera communiqué au propriétaire de la fiche{' '}
          <strong>{dialog?.row.establishment.name}</strong>.
        </p>
      </ConfirmDialog>
    </div>
  );
}
