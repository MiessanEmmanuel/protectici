'use client';

import { FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { IMPORTS_ENABLED } from '@/lib/admin-access';
import { importsApi, type AdminImport } from '@/lib/api/imports';
import type {
  AdminEstablishmentQuery,
  EstablishmentStatus,
  EstablishmentType,
} from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button, buttonClasses } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusBadge } from '../../ui/StatusBadge';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { Badge } from '../../ui/Tag';
import { AdminPageHeader } from '../AdminPageHeader';
import { filterPanelClasses } from './panel';

type Sort = '-submitted_at' | 'name';

/** Lots d'import proposés dans le filtre (les plus récents ; contrat §10.2). Échec silencieux. */
function useRecentImports(enabled: boolean): AdminImport[] {
  const [items, setItems] = useState<AdminImport[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    importsApi
      .list({ page: 1 })
      .then((res) => {
        if (active) setItems(res.data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [enabled]);
  return items;
}

export function AdminEstablishmentsList({
  initialType = '',
  initialStatus = '',
  initialImportId = null,
  initialIncomplete = false,
  importsEnabled = IMPORTS_ENABLED,
}: {
  initialType?: EstablishmentType | '';
  initialStatus?: EstablishmentStatus | '';
  /** Lot d'import (lien « Voir les fiches de cet import », paramètre `import_id` de l'URL). */
  initialImportId?: number | null;
  /** Fiches incomplètes seulement (`incomplete=1` dans l'URL). */
  initialIncomplete?: boolean;
  /** Import Excel disponible (bouton, filtre « Lot d'import ») ; voir IMPORTS_ENABLED. */
  importsEnabled?: boolean;
}) {
  const [type, setType] = useState<EstablishmentType | ''>(initialType);
  const [status, setStatus] = useState<EstablishmentStatus | ''>(initialStatus);
  const [importId, setImportId] = useState<number | null>(
    importsEnabled ? initialImportId : null,
  );
  const [incomplete, setIncomplete] = useState(initialIncomplete);
  const imports = useRecentImports(importsEnabled);
  const [sort, setSort] = useState<Sort>('-submitted_at');
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const state = useResource(() => {
    const query: AdminEstablishmentQuery = { sort, page };
    if (type) query.type = type;
    if (status) query.status = status;
    if (q) query.q = q;
    if (importId) query.import_id = importId;
    if (incomplete) query.incomplete = true;
    return clientApi.adminListEstablishments(query);
  }, [type, status, q, sort, page, importId, incomplete]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setQ(draftQ.trim().slice(0, 100));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        section="Annuaire"
        title="Établissements"
        description="Prestataires privés et forces étatiques : validation, vérification et mise en avant des fiches."
        actions={
          importsEnabled ? (
            <Link href="/admin/etablissements/import" className={buttonClasses('primary', 'sm')}>
              <FileSpreadsheet aria-hidden="true" />
              Importer un fichier
            </Link>
          ) : undefined
        }
      />

      <form
        role="search"
        aria-label="Filtrer les établissements"
        onSubmit={submit}
        className={`${filterPanelClasses} sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.6fr]`}
      >
        <Select
          label="Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as EstablishmentType | '');
            setPage(1);
          }}
        >
          <option value="">Tous les types</option>
          {(Object.keys(TYPE_LABELS) as EstablishmentType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select
          label="Statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EstablishmentStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as EstablishmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Tri"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort);
            setPage(1);
          }}
        >
          <option value="-submitted_at">Plus récentes d’abord</option>
          <option value="name">Nom (A à Z)</option>
        </Select>
        <div className="flex items-end gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
          <Input
            label="Recherche"
            type="search"
            value={draftQ}
            maxLength={100}
            onChange={(e) => setDraftQ(e.target.value)}
            wrapperClassName="min-w-0 flex-1"
          />
          <Button type="submit">Rechercher</Button>
        </div>
        {importsEnabled ? (
          <Select
            label="Lot d’import"
            value={importId ? String(importId) : ''}
            onChange={(e) => {
              const v = Number(e.target.value);
              setImportId(Number.isInteger(v) && v > 0 ? v : null);
              setPage(1);
            }}
          >
            <option value="">Tous les lots</option>
            {importId && !imports.some((i) => i.id === importId) ? (
              <option value={String(importId)}>Import n° {importId}</option>
            ) : null}
            {imports.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {`N° ${i.id} · ${i.original_name}`}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="flex items-end">
          <Checkbox
            label="Fiches incomplètes seulement"
            hint="Sans coordonnées, téléphone, description ou services / démarches."
            checked={incomplete}
            onChange={(e) => {
              setIncomplete(e.target.checked);
              setPage(1);
            }}
          />
        </div>
      </form>

      <QueryBoundary state={state} loadingLabel="Chargement des établissements…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun établissement">
              Aucun établissement ne correspond à ces critères.
            </EmptyState>
          ) : (
            <>
              <Table caption="Liste des établissements">
                <THead>
                  <Tr>
                    <Th>Nom</Th>
                    <Th>Type</Th>
                    <Th>Ville</Th>
                    <Th>Propriétaire</Th>
                    <Th>Statut</Th>
                    <Th>Soumise le</Th>
                  </Tr>
                </THead>
                <tbody>
                  {res.data.map((row) => (
                    <Tr key={`${row.type}-${row.id}`}>
                      <Td className="min-w-48">
                        <Link
                          href={`/admin/etablissements/${row.type}/${row.id}`}
                          className="font-semibold"
                        >
                          {row.name}
                        </Link>
                      </Td>
                      <Td>{TYPE_LABELS[row.type]}</Td>
                      <Td className="text-muted">{row.city.name}</Td>
                      <Td className="min-w-48">
                        {row.owner ? (
                          <>
                            <span className="block">{row.owner.name}</span>
                            <span className="block text-sm text-muted">{row.owner.email}</span>
                          </>
                        ) : (
                          <span className="text-muted">Aucun</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={row.status} />
                          {row.is_verified ? <Badge tone="success">Vérifié</Badge> : null}
                          {row.is_featured ? <Badge tone="accent">À la une</Badge> : null}
                          {row.is_incomplete ? <Badge tone="danger">Incomplète</Badge> : null}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-muted">
                        {formatDate(row.submitted_at)}
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
    </div>
  );
}
