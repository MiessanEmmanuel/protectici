'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { EstablishmentType, MyEstablishment, ReferenceData } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button, ButtonLink } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { QueryBoundary } from '../ui/QueryBoundary';
import { StatusBadge } from '../ui/StatusBadge';
import { Tabs, type TabDef } from '../ui/Tabs';
import { useToast } from '../ui/Toast';
import { ChangeRequestsTab } from './ChangeRequestsTab';
import { DocumentsTab } from './DocumentsTab';
import { ExecutivesTab } from './ExecutivesTab';
import { InfoTab } from './InfoTab';
import { MediaTab } from './MediaTab';
import type { TabProps } from './manager-types';

export function EstablishmentManager({
  type,
  slug,
  reference,
}: {
  type: EstablishmentType;
  slug: string;
  reference: ReferenceData;
}) {
  const state = useResource(() => clientApi.getMyEstablishment(type, slug), [type, slug]);
  return (
    <QueryBoundary state={state} loadingLabel="Chargement de votre fiche…">
      {(est) => (
        <Manager
          est={est}
          reference={reference}
          onSaved={state.setData}
          reload={state.reload}
        />
      )}
    </QueryBoundary>
  );
}

function Manager({
  est,
  reference,
  onSaved,
  reload,
}: Omit<TabProps, 'readOnly'>) {
  const readOnly = est.status === 'suspended';
  const props: TabProps = { est, reference, readOnly, onSaved, reload };
  const tabs: TabDef[] = [
    { id: 'info', label: 'Informations', content: <InfoTab {...props} /> },
    ...(est.type === 'provider'
      ? [{ id: 'executives', label: 'Dirigeants', content: <ExecutivesTab {...props} /> }]
      : []),
    { id: 'media', label: 'Médias', content: <MediaTab {...props} /> },
    { id: 'documents', label: 'Justificatifs', content: <DocumentsTab {...props} /> },
    {
      id: 'changes',
      label: 'Modifications sensibles',
      content: <ChangeRequestsTab {...props} />,
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">{est.name}</h2>
        <p className="flex flex-wrap items-center gap-2 text-muted">
          <span>{TYPE_LABELS[est.type]}</span>
          <StatusBadge status={est.status} />
        </p>
      </header>
      <StatusBanner est={est} reload={reload} />
      <Tabs tabs={tabs} label="Gestion de la fiche" />
    </div>
  );
}

function StatusBanner({ est, reload }: { est: MyEstablishment; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  if (est.status === 'pending') {
    return (
      <div role="status" className="rounded-lg border border-line bg-surface-alt p-4">
        <p className="font-semibold">Fiche en attente de validation</p>
        <p>
          Notre équipe examine votre demande{est.submitted_at ? ` envoyée le ${formatDate(est.submitted_at)}` : ''}.
          Vous pouvez compléter la fiche en attendant. Elle sera visible publiquement après validation.
        </p>
      </div>
    );
  }
  if (est.status === 'approved') {
    const href = est.type === 'provider' ? `/annuaire/${est.slug}` : `/forces-etatiques/${est.slug}`;
    return (
      <div role="status" className="rounded-lg border border-success bg-success-soft p-4">
        <p className="font-semibold">Fiche validée</p>
        <p>
          Votre fiche est publiée.{' '}
          {est.is_visible ? (
            <a href={href} className="underline">
              Voir la fiche publique
            </a>
          ) : null}
        </p>
      </div>
    );
  }
  if (est.status === 'rejected') {
    return (
      <div className="rounded-lg border border-danger bg-danger-soft p-4">
        <p className="font-semibold text-danger">Fiche rejetée</p>
        <p>
          <span className="font-semibold">Motif : </span>
          {est.rejection_reason ?? 'Aucun motif n’a été communiqué.'}
        </p>
        <p className="mt-1 text-sm">
          Corrigez la fiche (informations, justificatifs) puis soumettez-la à nouveau.
        </p>
        <div className="mt-3">
          <Button onClick={() => setOpen(true)}>Soumettre à nouveau</Button>
        </div>
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title="Soumettre la fiche à nouveau ?"
          confirmLabel="Soumettre à nouveau"
          onConfirm={async () => {
            await clientApi.resubmitEstablishment(est.type, est.slug);
            toast.show('Fiche soumise à nouveau.', 'success');
            reload();
          }}
        >
          <p>La fiche repassera en attente de validation et notre équipe l’examinera de nouveau.</p>
        </ConfirmDialog>
      </div>
    );
  }
  if (est.status === 'suspended') {
    return (
      <div role="alert" className="rounded-lg border border-danger bg-danger-soft p-4">
        <p className="font-semibold text-danger">Fiche suspendue : lecture seule</p>
        <p>
          Cette fiche n’est plus visible publiquement et ne peut plus être modifiée. Contactez
          l’équipe ProtectIci pour en savoir plus.
        </p>
        <div className="mt-3">
          <ButtonLink href="/contact" variant="secondary">
            Contacter l’équipe
          </ButtonLink>
        </div>
      </div>
    );
  }
  return null;
}
