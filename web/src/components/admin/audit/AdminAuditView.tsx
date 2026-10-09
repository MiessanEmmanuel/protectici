'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminAuditLog, AuditLogQuery } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { eventLabel } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { auditJson } from './redact';

/** Clés du morph map de l'API (liste blanche côté serveur). */
const TYPE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  provider: 'Prestataire',
  state_force: 'Force étatique',
  review: 'Avis',
  post: 'Article',
  post_comment: 'Commentaire',
  partner: 'Partenaire',
  page: 'Page',
  feedback: '« Dis-moi tout »',
  quote_request: 'Demande de devis',
  contact_message: 'Message de contact',
  provider_change_request: 'Demande de modification',
  provider_document: 'Justificatif',
  media: 'Média',
  setting: 'Réglage',
};

interface Filters {
  event: string;
  user_id: string;
  auditable_type: string;
  from: string;
  to: string;
}
const EMPTY: Filters = { event: '', user_id: '', auditable_type: '', from: '', to: '' };
type Errors = Partial<Record<keyof Filters, string>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(v: string): boolean {
  if (!DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function validate(f: Filters): Errors {
  const e: Errors = {};
  const ev = f.event.trim();
  if (ev && (ev.length > 100 || !/^[a-z0-9_.:-]+$/i.test(ev))) {
    e.event = 'Saisissez un nom d’événement valide (lettres, chiffres, point, tiret).';
  }
  const uid = f.user_id.trim();
  if (uid && !/^[1-9]\d{0,9}$/.test(uid)) e.user_id = 'Saisissez un identifiant entier positif.';
  const from = f.from.trim();
  const to = f.to.trim();
  if (from && !validDate(from)) e.from = 'Date invalide (format AAAA-MM-JJ).';
  if (to && !validDate(to)) e.to = 'Date invalide (format AAAA-MM-JJ).';
  if (!e.from && !e.to && from && to && from > to) {
    e.to = 'La date de fin doit être postérieure ou égale à la date de début.';
  }
  return e;
}

function toQuery(f: Filters, page: number): AuditLogQuery {
  const q: AuditLogQuery = { page };
  if (f.event.trim()) q.event = f.event.trim();
  if (f.user_id.trim()) q.user_id = Number(f.user_id.trim());
  if (f.auditable_type) q.auditable_type = f.auditable_type;
  if (f.from.trim()) q.from = f.from.trim();
  if (f.to.trim()) q.to = f.to.trim();
  return q;
}

export function AdminAuditView() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [page, setPage] = useState(1);

  const state = useResource(() => clientApi.adminListAuditLogs(toQuery(applied, page)), [applied, page]);

  function apply(e: FormEvent) {
    e.preventDefault();
    const errs = validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setApplied(draft);
    setPage(1);
  }

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setErrors({});
    setPage(1);
  }

  const set = (k: keyof Filters) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Journal d’audit</h1>

      <form
        role="search"
        aria-label="Filtrer le journal"
        onSubmit={apply}
        noValidate
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Input
          label="Événement"
          value={draft.event}
          maxLength={100}
          onChange={(e) => set('event')(e.target.value)}
          error={errors.event}
          placeholder="ex. role_changed"
          autoComplete="off"
        />
        <Input
          label="Identifiant de l’utilisateur"
          inputMode="numeric"
          value={draft.user_id}
          onChange={(e) => set('user_id')(e.target.value)}
          error={errors.user_id}
          autoComplete="off"
        />
        <Select
          label="Type d’objet"
          value={draft.auditable_type}
          onChange={(e) => set('auditable_type')(e.target.value)}
        >
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          label="Du (AAAA-MM-JJ)"
          value={draft.from}
          onChange={(e) => set('from')(e.target.value)}
          error={errors.from}
          placeholder="2026-01-31"
          maxLength={10}
          autoComplete="off"
        />
        <Input
          label="Au (AAAA-MM-JJ)"
          value={draft.to}
          onChange={(e) => set('to')(e.target.value)}
          error={errors.to}
          placeholder="2026-12-31"
          maxLength={10}
          autoComplete="off"
        />
        <div className="flex items-end gap-3">
          <Button type="submit">Appliquer</Button>
          <Button variant="secondary" onClick={reset}>
            Réinitialiser
          </Button>
        </div>
      </form>

      <QueryBoundary state={state} loadingLabel="Chargement du journal…">
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState title="Aucune entrée ne correspond à ces filtres" />
          ) : (
            <div>
              <Table caption="Journal d’audit">
                <THead>
                  <Tr>
                    <Th>Date (UTC)</Th>
                    <Th>Événement</Th>
                    <Th>Utilisateur</Th>
                    <Th>Objet</Th>
                    <Th>Adresse IP</Th>
                    <Th>Détail</Th>
                  </Tr>
                </THead>
                <tbody>
                  {list.data.map((l) => (
                    <LogRow key={l.id} log={l} />
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={list.meta} onPage={setPage} disabled={state.loading} />
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function LogRow({ log }: { log: AdminAuditLog }) {
  const hasDetail = log.old_values !== null || log.new_values !== null;
  return (
    <Tr>
      <Td className="whitespace-nowrap">{formatDateTime(log.created_at)}</Td>
      <Td>
        <div>{eventLabel(log.event)}</div>
        <div className="text-xs text-muted">{log.event}</div>
      </Td>
      <Td>{log.user ? `${log.user.name} (n° ${log.user.id})` : 'Système'}</Td>
      <Td className="whitespace-nowrap">
        {TYPE_LABELS[log.auditable_type] ?? log.auditable_type} n° {log.auditable_id}
      </Td>
      <Td className="whitespace-nowrap">{log.ip_address ?? '—'}</Td>
      <Td>
        {hasDetail ? (
          <details>
            <summary className="min-h-tap cursor-pointer py-2">Voir le détail</summary>
            <div className="flex flex-col gap-3">
              {log.old_values !== null ? (
                <div>
                  <p className="font-semibold">Avant</p>
                  <pre className="max-w-md overflow-x-auto rounded-md bg-surface-alt p-2 text-xs">
                    {auditJson(log.old_values)}
                  </pre>
                </div>
              ) : null}
              {log.new_values !== null ? (
                <div>
                  <p className="font-semibold">Après</p>
                  <pre className="max-w-md overflow-x-auto rounded-md bg-surface-alt p-2 text-xs">
                    {auditJson(log.new_values)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : (
          <span className="text-muted">—</span>
        )}
      </Td>
    </Tr>
  );
}
