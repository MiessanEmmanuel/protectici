'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { NewsletterStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { SUBSCRIBER_STATUS_LABELS } from './labels';
import { AdminPageHeader } from '../AdminPageHeader';

/** Abonnés à la lettre d'information (lecture seule ; données personnelles : écran réservé aux administrateurs). */
export function AdminNewsletterView() {
  const [status, setStatus] = useState<NewsletterStatus | ''>('');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useResource(
    () => clientApi.adminListSubscribers({ ...(status ? { status } : {}), ...(q ? { q } : {}), page }),
    [status, q, page],
  );

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Site" title="Newsletter" />
      <form onSubmit={search} role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end border-2 border-ink bg-c4 p-3 sm:p-4">
        <Select label="Statut" value={status} wrapperClassName="sm:w-64" onChange={(e) => { setStatus(e.target.value as NewsletterStatus | ''); setPage(1); }}>
          <option value="">Tous</option>
          {(Object.keys(SUBSCRIBER_STATUS_LABELS) as NewsletterStatus[]).map((s) => (
            <option key={s} value={s}>{SUBSCRIBER_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Input label="Rechercher une adresse" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} wrapperClassName="sm:flex-1" />
        <Button type="submit" variant="secondary">Rechercher</Button>
      </form>
      <QueryBoundary state={list} loadingLabel="Chargement des abonnés…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun abonné" />
          ) : (
            <>
              <Table caption="Abonnés à la lettre d’information">
                <THead>
                  <Tr><Th>Adresse e-mail</Th><Th>Statut</Th><Th>Source</Th><Th>Inscription</Th><Th>Confirmation</Th></Tr>
                </THead>
                <tbody>
                  {res.data.map((s) => (
                    <Tr key={s.id}>
                      <Td>{s.email}</Td>
                      <Td>{SUBSCRIBER_STATUS_LABELS[s.status]}</Td>
                      <Td>{s.source ?? '—'}</Td>
                      <Td>{formatDateTime(s.created_at)}</Td>
                      <Td>{s.confirmed_at ? formatDateTime(s.confirmed_at) : '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
