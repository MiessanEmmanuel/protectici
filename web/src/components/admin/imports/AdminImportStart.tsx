'use client';

import { Download, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  importTemplateUrl,
  importsApi,
  type ImportPublishMode,
} from '@/lib/api/imports';
import type { EstablishmentType } from '@/lib/api/types';
import type { FileRules } from '@/lib/files';
import { formatDateTime } from '@/lib/format';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button, buttonClasses } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { FileInput } from '../../ui/FileInput';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Radio } from '../../ui/Radio';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { AdminPageHeader } from '../AdminPageHeader';
import { Panel } from '../etablissements/panel';
import { IMPORT_TYPE_LABELS, ImportStatusBadge } from './import-labels';

/** Contrôle côté client (UX) ; l'API vérifie l'extension, la signature OOXML, la taille et le nombre de lignes. */
export const XLSX_RULES: FileRules = {
  types: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  maxBytes: 5 * 1024 * 1024,
  typesLabel: 'classeur Excel (.xlsx)',
};

const TYPES: EstablishmentType[] = ['state_force', 'provider'];

/** Écran /admin/etablissements/import : modèle, téléversement et historique (contrat §10.2, §10.4). */
export function AdminImportStart() {
  const router = useRouter();
  const [type, setType] = useState<EstablishmentType>('state_force');
  const [mode, setMode] = useState<ImportPublishMode>('publish');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { run, busy, error } = useAsyncAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFileError(fileError ?? 'Choisissez le fichier Excel rempli.');
      return;
    }
    const res = await run(() => importsApi.upload({ type, publish_mode: mode, file }));
    if (res.ok) router.push(`/admin/etablissements/import/${res.value.id}`);
  }

  const serverFileError = error?.fields.file;
  const otherFieldError = error
    ? Object.entries(error.fields)
        .filter(([k]) => k !== 'file')
        .map(([, m]) => m)
        .join(' ')
    : '';

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        section="Annuaire"
        title="Import Excel"
        description="Créez des fiches en nombre à partir du modèle Excel. Le fichier est d’abord analysé : rien n’est créé avant votre confirmation."
        actions={
          <Link href="/admin/etablissements" className={buttonClasses('secondary', 'sm')}>
            Voir les fiches
          </Link>
        }
      />

      <Panel title="Nouvel import" titleId="nouvel-import" aria-labelledby="nouvel-import">
        <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-bold">1. Type de fiches</legend>
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
              {TYPES.map((t) => (
                <Radio
                  key={t}
                  name="import-type"
                  value={t}
                  label={IMPORT_TYPE_LABELS[t]}
                  checked={type === t}
                  onChange={() => setType(t)}
                  disabled={busy}
                />
              ))}
            </div>
            <div className="mt-2">
              <a
                href={importTemplateUrl(type)}
                className={buttonClasses('secondary', 'sm')}
                rel="nofollow"
              >
                <Download aria-hidden="true" />
                Télécharger le modèle ({IMPORT_TYPE_LABELS[type].toLowerCase()})
              </a>
              <p className="mt-1 text-sm text-muted">
                Les listes déroulantes du modèle sont à jour des référentiels. Colonnes marquées
                d’un astérisque : obligatoires ; valeurs multiples séparées par « ; ».
              </p>
            </div>
          </fieldset>

          <div>
            <p className="mb-1 font-bold">2. Fichier rempli</p>
            <FileInput
              label="Classeur Excel (.xlsx)"
              rules={XLSX_RULES}
              required
              disabled={busy}
              hint="5 Mo et 2 000 lignes au maximum."
              error={fileError ?? serverFileError}
              onChange={(f, problem) => {
                setFile(f);
                setFileError(problem);
              }}
            />
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-bold">3. Statut des fiches créées</legend>
            <Radio
              name="publish-mode"
              value="publish"
              label="Publier directement"
              hint="Les fiches sont validées et visibles dès la fin de l’import (sans badge « vérifié »)."
              checked={mode === 'publish'}
              onChange={() => setMode('publish')}
              disabled={busy}
            />
            <Radio
              name="publish-mode"
              value="pending"
              label="À valider"
              hint="Les fiches sont créées en attente et restent masquées jusqu’à leur validation."
              checked={mode === 'pending'}
              onChange={() => setMode('pending')}
              disabled={busy}
            />
          </fieldset>

          <FormError message={error?.form ?? (otherFieldError || null)} />
          <div>
            <Button type="submit" loading={busy}>
              <Upload aria-hidden="true" />
              Téléverser et analyser
            </Button>
          </div>
        </form>
      </Panel>

      <ImportHistory />
    </div>
  );
}

function ImportHistory() {
  const [page, setPage] = useState(1);
  const state = useResource(() => importsApi.list({ page }), [page]);
  return (
    <Panel title="Historique des imports" titleId="historique-imports" aria-labelledby="historique-imports">
      <QueryBoundary state={state} loadingLabel="Chargement de l’historique…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun import">Aucun fichier n’a encore été importé.</EmptyState>
          ) : (
            <>
              <Table caption="Historique des imports">
                <THead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Fichier</Th>
                    <Th>Type</Th>
                    <Th>Auteur</Th>
                    <Th>Lignes</Th>
                    <Th>Créées</Th>
                    <Th>Statut</Th>
                  </Tr>
                </THead>
                <tbody>
                  {res.data.map((imp) => (
                    <Tr key={imp.id}>
                      <Td className="whitespace-nowrap text-muted">
                        {formatDateTime(imp.created_at)}
                      </Td>
                      <Td className="min-w-48">
                        <Link
                          href={`/admin/etablissements/import/${imp.id}`}
                          className="font-semibold break-all"
                        >
                          {imp.original_name}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{IMPORT_TYPE_LABELS[imp.type]}</Td>
                      <Td>{imp.created_by?.name ?? '—'}</Td>
                      <Td className="whitespace-nowrap">
                        {imp.rows_total}
                        <span className="block text-xs text-muted">
                          {imp.rows_valid} valides · {imp.rows_invalid} en erreur ·{' '}
                          {imp.rows_duplicate} doublons
                        </span>
                      </Td>
                      <Td>{imp.rows_created}</Td>
                      <Td>
                        <ImportStatusBadge status={imp.status} cancelledAt={imp.cancelled_at} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={state.loading} />
            </>
          )
        }
      </QueryBoundary>
    </Panel>
  );
}
