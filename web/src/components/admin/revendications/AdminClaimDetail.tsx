'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CLAIM_REJECT_MIN,
  CLAIM_STATUS_LABELS,
  claimsApi,
  establishmentPublicPath,
  type AdminClaim,
} from '@/lib/api/claims';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { formatBytes } from '@/lib/files';
import { formatDateTime, formatPhone } from '@/lib/format';
import { SUBMITTER_LABELS, TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormError } from '../../ui/Field';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Badge } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { AdminPageHeader } from '../AdminPageHeader';
import { DefList, DefRow, Panel, PanelNote } from '../etablissements/panel';
import { claimTone } from './AdminClaimsView';

type Dialog = 'approve' | 'reject';

function friendly(e: unknown): unknown {
  if (e instanceof ApiError && e.status === 404) {
    return new ApiError(404, 'Cette demande est introuvable : elle a peut-être été supprimée.');
  }
  if (e instanceof ApiError && e.status === 409) {
    return new ApiError(409, e.message || 'Cette fiche est déjà gérée par un compte.');
  }
  return e;
}

/** Détail d'une revendication : fiche, demandeur, justificatif, accepter / refuser. */
export function AdminClaimDetail({ id }: { id: number }) {
  const state = useResource(() => claimsApi.adminGetClaim(id), [id]);
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function approve() {
    try {
      const updated = await claimsApi.adminApproveClaim(id);
      state.setData(updated);
      setNotice('Revendication acceptée.');
      toast.show('Revendication acceptée : le compte gère désormais la fiche.', 'success');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) state.reload();
      throw friendly(e);
    }
  }

  async function reject(reason?: string) {
    try {
      await claimsApi.adminRejectClaim(id, reason ?? '');
      state.reload();
      setNotice('Revendication refusée.');
      toast.show('Revendication refusée : le demandeur sera prévenu par e-mail.', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) state.reload();
      throw friendly(e);
    }
  }

  async function download(claim: AdminClaim) {
    if (downloading || !claim.document) return;
    setDownloading(true);
    setPageError(null);
    try {
      const blob = await claimsApi.adminDownloadClaimDocument(claim.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = claim.document.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setPageError(errorMessage(friendly(e)));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/revendications" className="underline">
          ← Toutes les revendications
        </Link>
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      <QueryBoundary state={state} loadingLabel="Chargement de la demande…">
        {(c) => (
          <>
            <AdminPageHeader
              section="Revendication"
              title={c.establishment.name}
              meta={<Badge tone={claimTone(c.status)}>{CLAIM_STATUS_LABELS[c.status]}</Badge>}
              description={`Demande n° ${c.id}, reçue le ${formatDateTime(c.created_at)}.`}
              actions={
                c.status === 'pending' ? (
                  <>
                    <Button onClick={() => setDialog('approve')}>Accepter</Button>
                    <Button variant="secondary" onClick={() => setDialog('reject')}>
                      Refuser
                    </Button>
                  </>
                ) : undefined
              }
            />
            <FormError message={pageError} />

            <Panel title="Fiche concernée" titleId="claim-fiche" aria-labelledby="claim-fiche">
              <DefList>
                <DefRow label="Nom">{c.establishment.name}</DefRow>
                <DefRow label="Type">{TYPE_LABELS[c.establishment.type]}</DefRow>
                <DefRow label="Ville">{c.establishment.city.name}</DefRow>
              </DefList>
              <div className="flex flex-wrap gap-4 text-sm font-bold">
                <Link
                  href={`/admin/etablissements/${c.establishment.type}/${c.establishment.id}`}
                  className="underline"
                >
                  Ouvrir la fiche dans l’administration
                </Link>
                <Link
                  href={establishmentPublicPath(c.establishment.type, c.establishment.slug)}
                  className="underline"
                  target="_blank"
                  rel="noopener"
                >
                  Voir la fiche publique<span className="sr-only"> (nouvel onglet)</span>
                </Link>
              </div>
            </Panel>

            <Panel title="Demandeur" titleId="claim-demandeur" aria-labelledby="claim-demandeur">
              <PanelNote>
                Données personnelles : ne les utilisez que pour vérifier cette demande.
              </PanelNote>
              <DefList>
                <DefRow label="Nom">{c.user ? c.user.name : 'Compte supprimé'}</DefRow>
                <DefRow label="Adresse e-mail">{c.user?.email}</DefRow>
                <DefRow label="Qualité">{SUBMITTER_LABELS[c.submitter_role]}</DefRow>
                <DefRow label="Téléphone">{c.phone ? formatPhone(c.phone) : null}</DefRow>
                <DefRow label="Message">
                  {c.message ? <span className="whitespace-pre-line">{c.message}</span> : null}
                </DefRow>
              </DefList>
            </Panel>

            <Panel
              title="Justificatif"
              titleId="claim-justificatif"
              aria-labelledby="claim-justificatif"
            >
              {c.document ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 break-words">
                    <span className="font-semibold">{c.document.name}</span>
                    <span className="text-muted"> · {formatBytes(c.document.size_bytes)}</span>
                  </p>
                  <Button
                    variant="secondary"
                    loading={downloading}
                    onClick={() => void download(c)}
                  >
                    Télécharger le justificatif
                  </Button>
                </div>
              ) : (
                <p className="text-muted">Aucun justificatif disponible.</p>
              )}
            </Panel>

            {c.status !== 'pending' ? (
              <Panel title="Décision" titleId="claim-decision" aria-labelledby="claim-decision">
                <DefList>
                  <DefRow label="Statut">{CLAIM_STATUS_LABELS[c.status]}</DefRow>
                  <DefRow label="Traitée le">
                    {c.reviewed_at ? formatDateTime(c.reviewed_at) : null}
                  </DefRow>
                  <DefRow label="Par">{c.reviewer?.name}</DefRow>
                  {c.status === 'rejected' ? (
                    <DefRow label="Motif du refus">{c.rejection_reason}</DefRow>
                  ) : null}
                </DefList>
              </Panel>
            ) : null}

            <ConfirmDialog
              open={dialog === 'approve'}
              onClose={() => setDialog(null)}
              title="Accepter la revendication"
              confirmLabel="Accepter"
              onConfirm={approve}
            >
              <p>
                Le compte {c.user ? <strong>{c.user.email}</strong> : 'demandeur'} deviendra
                propriétaire de la fiche <strong>{c.establishment.name}</strong> et pourra la
                modifier. Les autres demandes en attente sur cette fiche seront refusées. Un e-mail
                sera envoyé au demandeur.
              </p>
            </ConfirmDialog>
            <ConfirmDialog
              open={dialog === 'reject'}
              onClose={() => setDialog(null)}
              title="Refuser la revendication"
              confirmLabel="Refuser"
              tone="danger"
              reasonLabel="Motif du refus"
              minReason={CLAIM_REJECT_MIN}
              onConfirm={reject}
            >
              <p>Le motif sera communiqué au demandeur par e-mail.</p>
            </ConfirmDialog>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
