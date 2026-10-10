'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type {
  AdminFeedbackQuery,
  AdminFeedbackRow,
  FeedbackActionType,
  FeedbackStatus,
} from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import {
  FEEDBACK_ACTION_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TARGET_LABELS,
} from '@/lib/labels';
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
import { FeedbackDetail } from './FeedbackDetail';

type Sort = '-created_at' | 'status';

export function AdminFeedbackView({ initialStatus = '' }: { initialStatus?: FeedbackStatus | '' }) {
  const [status, setStatus] = useState<FeedbackStatus | ''>(initialStatus);
  const [action, setAction] = useState<FeedbackActionType | ''>('');
  const [sort, setSort] = useState<Sort>('-created_at');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const query: AdminFeedbackQuery = { sort, page };
  if (status) query.status = status;
  if (action) query.action_type = action;
  if (q) query.q = q;
  const list = useResource(() => clientApi.adminListFeedbacks(query), [status, action, sort, q, page]);

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
      <h1 className="text-2xl font-bold sm:text-3xl">Dis-moi tout</h1>
      <p className="text-muted">
        Retours des internautes sur les prestataires : encouragements, questions, plaintes et
        suggestions. Ouvrez un dossier pour changer son statut, l’affecter et répondre.
      </p>

      <form onSubmit={search} role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Statut du dossier"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as FeedbackStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((s) => (
            <option key={s} value={s}>
              {FEEDBACK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Type d’action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value as FeedbackActionType | '');
            setPage(1);
          }}
        >
          <option value="">Tous les types</option>
          {(Object.keys(FEEDBACK_ACTION_LABELS) as FeedbackActionType[]).map((a) => (
            <option key={a} value={a}>
              {FEEDBACK_ACTION_LABELS[a]}
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
          <option value="-created_at">Plus récents d’abord</option>
          <option value="status">Par statut</option>
        </Select>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Référence, nom ou e-mail"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            wrapperClassName="flex-1"
          />
          <Button type="submit" variant="secondary">
            Rechercher
          </Button>
        </div>
      </form>

      <QueryBoundary state={list} loadingLabel="Chargement des dossiers…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun dossier">Aucun dossier ne correspond à ces critères.</EmptyState>
          ) : (
            <>
              <Table caption="Dossiers « Dis-moi tout »">
                <THead>
                  <tr>
                    <Th>Référence</Th>
                    <Th>Auteur</Th>
                    <Th>Prestataire</Th>
                    <Th>Action</Th>
                    <Th>Objet</Th>
                    <Th>Statut</Th>
                    <Th>Affecté à</Th>
                    <Th>Reçu le</Th>
                    <Th>
                      <span className="sr-only">Ouvrir</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {res.data.map((row: AdminFeedbackRow) => (
                    <Tr key={row.id}>
                      <Td className="font-semibold whitespace-nowrap">{row.reference}</Td>
                      <Td>
                        {row.author.first_name} {row.author.last_name}
                        <span className="block text-muted">{row.author.email}</span>
                      </Td>
                      <Td>{row.provider?.name ?? '—'}</Td>
                      <Td>{FEEDBACK_ACTION_LABELS[row.action_type]}</Td>
                      <Td>{FEEDBACK_TARGET_LABELS[row.target_type]}</Td>
                      <Td>
                        <StatusPill kind="feedback" status={row.status} />
                      </Td>
                      <Td>{row.assigned_to?.name ?? 'Non affecté'}</Td>
                      <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
                      <Td>
                        <Button
                          variant={selected === row.id ? 'primary' : 'secondary'}
                          size="sm"
                          aria-pressed={selected === row.id}
                          aria-label={`Ouvrir le dossier ${row.reference}`}
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
          aria-label="Détail du dossier"
          className="scroll-mt-4 focus:outline-none"
        >
          <Card className="flex flex-col gap-5">
            <FeedbackDetail
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
