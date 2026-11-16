'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import {
  importsApi,
  type AdminImport,
  type AdminImportRow,
  type ImportDecision,
  type ImportRowStatus,
} from '@/lib/api/imports';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Radio } from '../../ui/Radio';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { DUPLICATE_REASON_LABELS } from './import-labels';

export const ROWS_PER_PAGE = 25;

const EMPTY: Record<ImportRowStatus, string> = {
  valid: 'Aucune ligne valide.',
  invalid: 'Aucune ligne en erreur.',
  duplicate: 'Aucun doublon probable.',
};

const CAPTION: Record<ImportRowStatus, string> = {
  valid: 'Lignes valides',
  invalid: 'Lignes en erreur',
  duplicate: 'Doublons probables',
};

/** Contenu d'un onglet (valides / erreurs / doublons), paginé côté API. */
export function ImportRowsPanel({
  imp,
  status,
  onImportChange,
  onConflict,
}: {
  imp: AdminImport;
  status: ImportRowStatus;
  onImportChange: (imp: AdminImport) => void;
  /** 409 : l'import n'est plus modifiable, on relit son état. */
  onConflict: () => void;
}) {
  const [page, setPage] = useState(1);
  const state = useResource(
    () => importsApi.rows(imp.id, { status, page, per_page: ROWS_PER_PAGE }),
    [imp.id, status, page],
  );
  const { run, busy, error } = useAsyncAction();
  const editable = imp.status === 'ready';

  async function decide(row: AdminImportRow, decision: ImportDecision) {
    if (!state.data || row.decision === decision) return;
    const res = await run(async () => {
      try {
        return await importsApi.decide(imp.id, [{ line: row.line, decision }]);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) onConflict();
        throw e;
      }
    });
    if (!res.ok || !state.data) return;
    state.setData({
      ...state.data,
      data: state.data.data.map((r) => (r.line === row.line ? { ...r, decision } : r)),
    });
    onImportChange(res.value);
  }

  return (
    <QueryBoundary state={state} loadingLabel="Chargement des lignes…">
      {(res) =>
        res.data.length === 0 ? (
          <EmptyState title={EMPTY[status]} />
        ) : (
          <div className="flex flex-col gap-3">
            {status === 'duplicate' ? (
              <p className="text-sm text-muted">
                Par défaut, un doublon probable est ignoré. Choisissez « Créer quand même » si la
                ligne correspond bien à un autre établissement.
              </p>
            ) : null}
            <FormError message={error?.form} />
            <Table caption={CAPTION[status]}>
              <THead>
                <Tr>
                  <Th>Ligne</Th>
                  <Th>Nom</Th>
                  <Th>Ville</Th>
                  {status === 'invalid' ? <Th>Erreurs</Th> : null}
                  {status === 'duplicate' ? <Th>Fiche proche</Th> : null}
                  {status === 'duplicate' ? <Th>Décision</Th> : null}
                </Tr>
              </THead>
              <tbody>
                {res.data.map((row) => (
                  <Tr key={row.line}>
                    <Td className="whitespace-nowrap font-semibold">{row.line}</Td>
                    <Td className="min-w-40">{row.name ?? <span className="text-muted">—</span>}</Td>
                    <Td>{row.city ?? <span className="text-muted">—</span>}</Td>
                    {status === 'invalid' ? (
                      <Td className="min-w-56">
                        <ul className="flex flex-col gap-1">
                          {row.errors.map((err, i) => (
                            <li key={i}>
                              <span className="font-semibold">{err.column}</span> : {err.message}
                            </li>
                          ))}
                        </ul>
                      </Td>
                    ) : null}
                    {status === 'duplicate' ? (
                      <Td className="min-w-56">
                        <DuplicateOf row={row} />
                      </Td>
                    ) : null}
                    {status === 'duplicate' ? (
                      <Td className="min-w-52">
                        <fieldset>
                          <legend className="sr-only">Décision pour la ligne {row.line}</legend>
                          <Radio
                            name={`decision-${row.line}`}
                            value="skip"
                            label="Ignorer"
                            checked={(row.decision ?? 'skip') === 'skip'}
                            disabled={!editable || busy}
                            onChange={() => void decide(row, 'skip')}
                          />
                          <Radio
                            name={`decision-${row.line}`}
                            value="create"
                            label="Créer quand même"
                            checked={row.decision === 'create'}
                            disabled={!editable || busy}
                            onChange={() => void decide(row, 'create')}
                          />
                        </fieldset>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
            <PagerButtons meta={res.meta} onPage={setPage} disabled={state.loading} />
          </div>
        )
      }
    </QueryBoundary>
  );
}

function DuplicateOf({ row }: { row: AdminImportRow }) {
  const d = row.duplicate_of;
  if (!d) return <span className="text-muted">—</span>;
  const reason = DUPLICATE_REASON_LABELS[d.reason];
  if (d.type === 'row') {
    return (
      <span>
        Ligne {d.id} du fichier
        <span className="block text-sm text-muted">{reason}</span>
      </span>
    );
  }
  return (
    <span>
      <Link href={`/admin/etablissements/${d.type}/${d.id}`} className="font-semibold">
        {d.name}
      </Link>
      <span className="block text-sm text-muted">
        {d.city} · {reason}
      </span>
    </span>
  );
}
