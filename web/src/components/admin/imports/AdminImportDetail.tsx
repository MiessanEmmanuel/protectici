'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { importReportUrl, importsApi, type AdminImport } from '@/lib/api/imports';
import { formatDateTime, pluralize } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { Button, buttonClasses } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormSuccess } from '../../ui/Field';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Spinner } from '../../ui/Spinner';
import { Tabs } from '../../ui/Tabs';
import { Badge } from '../../ui/Tag';
import { AdminPageHeader } from '../AdminPageHeader';
import { Panel } from '../etablissements/panel';
import {
  IMPORT_TYPE_LABELS,
  ImportStatusBadge,
  PUBLISH_MODE_LABELS,
  isRunning,
} from './import-labels';
import { ImportRowsPanel } from './ImportRowsPanel';

export const POLL_MS = 2000;

/** Écran /admin/etablissements/import/[id] : suivi en direct, aperçu, décisions, confirmation, annulation. */
export function AdminImportDetail({ id }: { id: number }) {
  const state = useResource(() => importsApi.get(id), [id]);
  const reloadRef = useRef(state.reload);
  useEffect(() => {
    reloadRef.current = state.reload;
  });

  const imp = state.data;
  // Rafraîchissement toutes les 2 s tant que l'analyse ou la création tourne (contrat §10.2).
  useEffect(() => {
    if (!imp || state.loading || !isRunning(imp.status)) return;
    const t = setTimeout(() => reloadRef.current(), POLL_MS);
    return () => clearTimeout(t);
  }, [imp, state.loading]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/etablissements/import" className="inline-flex items-center gap-2 self-start font-semibold">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Retour aux imports
      </Link>
      <QueryBoundary state={state} loadingLabel="Chargement de l’import…">
        {(d) => <ImportView imp={d} onChange={(next) => state.setData(next)} onReload={state.reload} />}
      </QueryBoundary>
    </div>
  );
}

function statusMessage(imp: AdminImport): string {
  switch (imp.status) {
    case 'uploaded':
    case 'analyzing':
      return 'Analyse du fichier en cours… Cette page se met à jour automatiquement.';
    case 'importing':
      return 'Création des fiches en cours… Cette page se met à jour automatiquement.';
    case 'ready':
      return `Analyse terminée : ${pluralize(imp.rows_valid, 'ligne valide', 'lignes valides')}, ${imp.rows_invalid} en erreur, ${pluralize(imp.rows_duplicate, 'doublon probable', 'doublons probables')}. Vérifiez puis confirmez l’import.`;
    case 'done':
      return imp.cancelled_at
        ? 'Import annulé : les fiches sans propriétaire et sans avis ont été supprimées.'
        : `Import terminé : ${pluralize(imp.rows_created, 'fiche créée', 'fiches créées')}.`;
    case 'failed':
      return 'L’analyse du fichier a échoué.';
    case 'cancelled':
      return 'Import annulé. Aucune fiche n’a été créée.';
  }
}

function ImportView({
  imp,
  onChange,
  onReload,
}: {
  imp: AdminImport;
  onChange: (imp: AdminImport) => void;
  onReload: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const running = isRunning(imp.status);
  const analyzed = imp.status !== 'uploaded' && imp.status !== 'analyzing';
  const showRows = analyzed && imp.rows_total > 0;
  // Les onglets se rechargent quand l'état de l'import change (fin d'analyse, décisions, création).
  const rowsKey = `${imp.status}-${imp.rows_total}-${imp.rows_created}`;

  return (
    <>
      <AdminPageHeader
        section="Import Excel"
        title={<span className="break-all">{imp.original_name}</span>}
        meta={
          <>
            <ImportStatusBadge status={imp.status} cancelledAt={imp.cancelled_at} />
            <Badge>{IMPORT_TYPE_LABELS[imp.type]}</Badge>
            <Badge>{PUBLISH_MODE_LABELS[imp.publish_mode]}</Badge>
          </>
        }
        description={
          <>
            Déposé le {formatDateTime(imp.created_at)}
            {imp.created_by ? ` par ${imp.created_by.name}` : ''}
            {imp.finished_at ? ` · terminé le ${formatDateTime(imp.finished_at)}` : ''}.
          </>
        }
      />

      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-lg border border-line bg-white p-4"
      >
        {running ? <Spinner label="" className="mt-0.5 size-5 shrink-0" /> : null}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{statusMessage(imp)}</p>
          {imp.status === 'failed' && imp.failure_message ? (
            <p className="text-danger">{imp.failure_message}</p>
          ) : null}
        </div>
      </div>

      <FormSuccess message={notice} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Compteurs de l’import">
        <Counter label="Lignes lues" value={imp.rows_total} />
        <Counter label="Valides" value={imp.rows_valid} />
        <Counter label="En erreur" value={imp.rows_invalid} />
        <Counter label="Doublons probables" value={imp.rows_duplicate} />
        <Counter label="Fiches créées" value={imp.rows_created} />
      </ul>

      <div className="flex flex-wrap gap-2">
        {imp.status === 'ready' || imp.status === 'importing' ? (
          <Button
            variant="primary"
            disabled={!imp.can_confirm}
            loading={imp.status === 'importing'}
            onClick={() => setConfirming(true)}
          >
            Confirmer l’import
          </Button>
        ) : null}
        {analyzed && imp.rows_invalid > 0 ? (
          <a href={importReportUrl(imp.id)} className={buttonClasses('secondary')} rel="nofollow">
            <Download aria-hidden="true" />
            Télécharger le rapport d’erreurs
          </a>
        ) : null}
        {imp.rows_created > 0 ? (
          <Link
            href={`/admin/etablissements?import_id=${imp.id}`}
            className={buttonClasses('secondary')}
          >
            Voir les fiches de cet import
          </Link>
        ) : null}
        {imp.can_cancel ? (
          <Button variant="ghost" onClick={() => setCancelling(true)}>
            Annuler l’import
          </Button>
        ) : null}
      </div>
      {imp.status === 'ready' && !imp.can_confirm ? (
        <p className="text-sm text-muted">
          Aucune ligne à créer : corrigez le fichier à l’aide du rapport d’erreurs puis importez-le
          de nouveau, ou choisissez « Créer quand même » pour un doublon.
        </p>
      ) : null}

      {showRows ? (
        <Panel title="Aperçu des lignes" titleId="apercu-lignes" aria-labelledby="apercu-lignes">
          <Tabs
            label="Lignes du fichier"
            tabs={[
              {
                id: 'valid',
                label: `Valides (${imp.rows_valid})`,
                content: <ImportRowsPanel key={rowsKey} imp={imp} status="valid" onImportChange={onChange} onConflict={onReload} />,
              },
              {
                id: 'invalid',
                label: `Erreurs (${imp.rows_invalid})`,
                content: <ImportRowsPanel key={rowsKey} imp={imp} status="invalid" onImportChange={onChange} onConflict={onReload} />,
              },
              {
                id: 'duplicate',
                label: `Doublons (${imp.rows_duplicate})`,
                content: <ImportRowsPanel key={rowsKey} imp={imp} status="duplicate" onImportChange={onChange} onConflict={onReload} />,
              },
            ]}
          />
        </Panel>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmer l’import ?"
        confirmLabel="Créer les fiches"
        onConfirm={async () => {
          const next = await importsApi.confirm(imp.id);
          setNotice(null);
          onChange(next);
        }}
      >
        <p>
          Lignes valides ({imp.rows_valid}) et
          les doublons marqués « Créer quand même » deviendront des fiches{' '}
          {imp.publish_mode === 'publish'
            ? 'publiées et visibles immédiatement'
            : 'en attente de validation, non visibles'}
          . Les lignes en erreur et les doublons ignorés ne seront pas créés.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Annuler l’import ?"
        confirmLabel="Annuler l’import"
        tone="danger"
        onConfirm={async () => {
          const res = await importsApi.cancel(imp.id);
          onChange(res.data);
          setNotice(
            imp.status === 'done'
              ? `${pluralize(res.deleted_count, 'fiche supprimée', 'fiches supprimées')}.`
              : 'Import annulé.',
          );
        }}
      >
        {imp.status === 'done' ? (
          <p>
            Les fiches créées par cet import ({imp.rows_created}) qui n’ont encore{' '}
            <strong>ni propriétaire ni avis</strong> seront supprimées (suppression logique). Les
            fiches déjà revendiquées par un établissement ou ayant reçu un avis sont conservées.
          </p>
        ) : (
          <p>
            Aucune fiche n’a encore été créée : l’import sera simplement marqué comme annulé et ne
            pourra plus être confirmé.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-line bg-white p-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-extrabold">{value}</span>
    </li>
  );
}
