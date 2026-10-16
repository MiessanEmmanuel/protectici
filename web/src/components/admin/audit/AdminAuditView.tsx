'use client';

import { createElement, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  FileText,
  KeyRound,
  LogIn,
  Pencil,
  ScrollText,
  ShieldAlert,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
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
import { auditJson } from './redact';
import { AdminPageHeader } from '../AdminPageHeader';
import { FILTER_PANEL } from '../content/AdminKit';

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

/** Icône indicative de l'événement (décorative : le libellé français porte le sens). */
function eventIcon(event: string): LucideIcon {
  const e = event.toLowerCase();
  if (/login|logout|session/.test(e)) return LogIn;
  if (/password|two_factor|2fa|token/.test(e)) return KeyRound;
  if (/fail|denied|block|lock|suspend|spam|reject/.test(e)) return ShieldAlert;
  if (/delet|anonymi|purge/.test(e)) return Trash2;
  if (/approv|validat|publish|confirm|verif/.test(e)) return BadgeCheck;
  if (/creat|regist|signup/.test(e)) return UserPlus;
  if (/download|document|export/.test(e)) return FileText;
  if (/updat|chang|edit|role/.test(e)) return Pencil;
  return ScrollText;
}

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
      <AdminPageHeader section="Système" title="Journal d’audit" />

      <form
        role="search"
        aria-label="Filtrer le journal"
        onSubmit={apply}
        noValidate
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${FILTER_PANEL}`}
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
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">Appliquer</Button>
          <Button variant="secondary" onClick={reset}>
            Réinitialiser
          </Button>
        </div>
      </form>

      <QueryBoundary state={state} loadingLabel="Chargement du journal…">
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState title="Aucune entrée ne correspond à ces filtres">
              Modifiez ou réinitialisez les filtres pour élargir la recherche.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              <section
                aria-labelledby="audit-list-title"
                className="rounded-lg border border-line bg-white p-4 sm:p-6"
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="audit-list-title" className="text-lg font-bold">
                    Événements
                  </h2>
                  <p className="text-sm text-muted">Dates en UTC</p>
                </div>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {list.data.map((l) => (
                    <LogRow key={l.id} log={l} />
                  ))}
                </ul>
              </section>
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
    <li className="flex gap-3 py-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-pill border border-line bg-surface-alt text-ink"
      >
        {createElement(eventIcon(log.event), { className: 'size-4' })}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-semibold text-ink">{eventLabel(log.event)}</p>
          <time dateTime={log.created_at} className="text-sm whitespace-nowrap text-muted">
            {formatDateTime(log.created_at)}
          </time>
        </div>
        <p className="font-mono text-xs text-muted">{log.event}</p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <div className="flex gap-1">
            <dt>Utilisateur :</dt>
            <dd className="text-ink">{log.user ? `${log.user.name} (n° ${log.user.id})` : 'Système'}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Objet :</dt>
            <dd className="text-ink">
              {TYPE_LABELS[log.auditable_type] ?? log.auditable_type} n° {log.auditable_id}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Adresse IP :</dt>
            <dd className="text-ink">{log.ip_address ?? '—'}</dd>
          </div>
        </dl>
        {hasDetail ? (
          <details className="mt-1">
            <summary className="min-h-tap cursor-pointer py-2 text-sm font-semibold">Voir le détail</summary>
            <div className="grid gap-3 sm:grid-cols-2">
              {log.old_values !== null ? (
                <div className="min-w-0">
                  <p className="mb-1 text-sm font-semibold">Avant</p>
                  <pre className="scroll-x rounded-md border border-line bg-surface-alt p-3 text-xs">
                    {auditJson(log.old_values)}
                  </pre>
                </div>
              ) : null}
              {log.new_values !== null ? (
                <div className="min-w-0">
                  <p className="mb-1 text-sm font-semibold">Après</p>
                  <pre className="scroll-x rounded-md border border-line bg-surface-alt p-3 text-xs">
                    {auditJson(log.new_values)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}
