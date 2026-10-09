'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type {
  AdminEstablishmentQuery,
  EstablishmentStatus,
  EstablishmentType,
} from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusBadge } from '../../ui/StatusBadge';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { Badge } from '../../ui/Tag';

type Sort = '-submitted_at' | 'name';

export function AdminEstablishmentsList({
  initialType = '',
  initialStatus = '',
}: {
  initialType?: EstablishmentType | '';
  initialStatus?: EstablishmentStatus | '';
}) {
  const [type, setType] = useState<EstablishmentType | ''>(initialType);
  const [status, setStatus] = useState<EstablishmentStatus | ''>(initialStatus);
  const [sort, setSort] = useState<Sort>('-submitted_at');
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const state = useResource(() => {
    const query: AdminEstablishmentQuery = { sort, page };
    if (type) query.type = type;
    if (status) query.status = status;
    if (q) query.q = q;
    return clientApi.adminListEstablishments(query);
  }, [type, status, q, sort, page]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setQ(draftQ.trim().slice(0, 100));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Établissements</h1>

      <form
        role="search"
        aria-label="Filtrer les établissements"
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
        <div className="flex items-end gap-2">
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
                      <Td>{row.city.name}</Td>
                      <Td className="min-w-48">
                        {row.owner ? (
                          <>
                            {row.owner.name}
                            <br />
                            <span className="text-muted">{row.owner.email}</span>
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
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(row.submitted_at)}</Td>
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
