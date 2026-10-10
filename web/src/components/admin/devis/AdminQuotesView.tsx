'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminQuoteRow, QuoteStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { QUOTE_STATUS_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusPill } from '../../ui/StatusPill';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { QuoteDetail } from './QuoteDetail';

export function AdminQuotesView({ initialStatus = '' }: { initialStatus?: QuoteStatus | '' }) {
  const [status, setStatus] = useState<QuoteStatus | ''>(initialStatus);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const list = useResource(
    () => clientApi.adminListQuotes({ ...(status ? { status } : {}), ...(q ? { q } : {}), page }),
    [status, q, page],
  );

  useEffect(() => {
    if (selected === null) return;
    const el = detailRef.current;
    el?.focus();
    if (typeof el?.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
  }, [selected]);

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Demandes de devis</h1>
      <p className="text-muted">
        Les demandes sans prestataire choisi sont à acheminer vers un à cinq prestataires publiés.
      </p>
      <form onSubmit={search} role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="Statut de la demande"
          value={status}
          wrapperClassName="sm:w-64"
          onChange={(e) => {
            setStatus(e.target.value as QuoteStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          label="Référence, nom ou e-mail"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          wrapperClassName="sm:flex-1"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>

      <QueryBoundary state={list} loadingLabel="Chargement des demandes…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucune demande">Aucune demande de devis ne correspond à ces critères.</EmptyState>
          ) : (
            <>
              <Table caption="Demandes de devis">
                <THead>
                  <tr>
                    <Th>Référence</Th>
                    <Th>Demandeur</Th>
                    <Th>Service</Th>
                    <Th>Ville</Th>
                    <Th>Destinataires</Th>
                    <Th>Statut</Th>
                    <Th>Reçue le</Th>
                    <Th>
                      <span className="sr-only">Ouvrir</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {res.data.map((row: AdminQuoteRow) => (
                    <Tr key={row.id}>
                      <Td className="font-semibold whitespace-nowrap">{row.reference}</Td>
                      <Td>
                        {row.requester_name}
                        <span className="block text-muted">{row.requester_email}</span>
                      </Td>
                      <Td>{row.service.name}</Td>
                      <Td>{row.city.name}</Td>
                      <Td>{row.recipients_count}</Td>
                      <Td>
                        <StatusPill kind="quote" status={row.status} />
                      </Td>
                      <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
                      <Td>
                        <Button
                          variant={selected === row.id ? 'primary' : 'secondary'}
                          size="sm"
                          aria-pressed={selected === row.id}
                          aria-label={`Ouvrir la demande ${row.reference}`}
                          onClick={() => setSelected(row.id)}
                        >
                          Ouvrir
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>

      {selected !== null ? (
        <section
          ref={detailRef}
          tabIndex={-1}
          aria-label="Détail de la demande"
          className="scroll-mt-4 focus:outline-none"
        >
          <Card className="flex flex-col gap-5">
            <QuoteDetail
              key={selected}
              id={selected}
              onChanged={list.reload}
              onClose={() => setSelected(null)}
            />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
