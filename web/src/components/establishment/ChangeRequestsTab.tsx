'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, describeError } from '@/lib/api/errors';
import type { ChangeRequest, EstablishmentType, MyEstablishment, ReferenceData } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { FIELD_LABELS } from '@/lib/labels';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Tag';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';
import { ErrorSummary } from './ErrorSummary';
import { displayFieldValue, SENSITIVE_FIELDS } from './manager-utils';
import type { TabProps } from './manager-types';

type Values = Record<string, string>;

function currentValues(est: MyEstablishment): Values {
  const rec = est as unknown as Record<string, unknown>;
  const out: Values = {};
  for (const f of SENSITIVE_FIELDS[est.type]) {
    const v = rec[f];
    out[f] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

const STATUS: Record<ChangeRequest['status'], { label: string; tone: 'accent' | 'success' | 'danger' }> = {
  pending: { label: 'En attente', tone: 'accent' },
  approved: { label: 'Acceptée', tone: 'success' },
  rejected: { label: 'Refusée', tone: 'danger' },
};

export function ChangeRequestsTab({ est, reference, readOnly, reload }: TabProps) {
  const pending = est.change_requests.find((c) => c.status === 'pending') ?? null;
  const history = est.change_requests.filter((c) => c.status !== 'pending');
  const fields = SENSITIVE_FIELDS[est.type];
  const current = currentValues(est);
  const rec = est as unknown as Record<string, unknown>;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section aria-labelledby="sensitive-title" className="flex flex-col gap-3">
        <h3 id="sensitive-title" className="text-lg font-semibold">
          Informations sensibles actuelles
        </h3>
        <p className="text-muted">
          Ces informations servent à vérifier votre établissement. Pour les modifier, envoyez une
          demande : notre équipe l’examinera avant de l’appliquer.
        </p>
        <dl className="divide-y divide-line rounded-lg border border-line px-4">
          {fields.map((f) => (
            <div key={f} className="grid gap-0.5 py-2 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">{FIELD_LABELS[f] ?? f}</dt>
              <dd className="break-words sm:col-span-2">
                {displayFieldValue(f, rec[f], reference)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {pending ? (
        <PendingRequest est={est} request={pending} reference={reference} readOnly={readOnly} reload={reload} />
      ) : null}

      <RequestForm
        key={JSON.stringify(current)}
        type={est.type}
        slug={est.slug}
        current={current}
        reference={reference}
        disabled={readOnly || pending !== null}
        disabledReason={
          readOnly
            ? 'La fiche est suspendue : aucune demande ne peut être envoyée.'
            : pending
              ? 'Une demande est déjà en attente : annulez-la ou attendez la réponse pour en envoyer une autre.'
              : null
        }
        reload={reload}
      />

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h3 id="history-title" className="text-lg font-semibold">
          Historique des demandes
        </h3>
        {history.length === 0 ? (
          <p className="text-muted">Aucune demande traitée pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((c) => (
              <li key={c.id} className="rounded-lg border border-line p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <span className="text-sm text-muted">
                    Envoyée le {formatDateTime(c.created_at)}
                    {c.reviewed_at ? `, traitée le ${formatDateTime(c.reviewed_at)}` : ''}
                  </span>
                </p>
                <Changes changes={c.changes} reference={reference} />
                {c.status === 'rejected' && c.rejection_reason ? (
                  <p className="mt-2 text-danger">Motif du refus : {c.rejection_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Changes({
  changes,
  reference,
}: {
  changes: ChangeRequest['changes'];
  reference: ReferenceData;
}) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {Object.entries(changes).map(([field, { old, new: next }]) => (
        <li key={field}>
          <span className="font-semibold">{FIELD_LABELS[field] ?? field}</span> :{' '}
          <span>{displayFieldValue(field, old, reference)}</span>
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> devient </span>
          <span className="font-medium">{displayFieldValue(field, next, reference)}</span>
        </li>
      ))}
    </ul>
  );
}

function PendingRequest({
  est,
  request,
  reference,
  readOnly,
  reload,
}: {
  est: MyEstablishment;
  request: ChangeRequest;
  reference: ReferenceData;
  readOnly: boolean;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <section
      aria-labelledby="pending-title"
      className="rounded-lg border border-accent-text bg-warning-soft p-4"
    >
      <h3 id="pending-title" className="text-lg font-semibold">
        Demande en attente
      </h3>
      <p className="text-sm text-muted">Envoyée le {formatDateTime(request.created_at)}</p>
      <Changes changes={request.changes} reference={reference} />
      {readOnly ? null : (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Annuler la demande
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Annuler cette demande ?"
        confirmLabel="Annuler la demande"
        tone="danger"
        onConfirm={async () => {
          try {
            await clientApi.cancelChangeRequest(est.type, est.slug, request.id);
          } catch (e) {
            // La demande a peut-être été traitée entre-temps : on recharge pour refléter l'état réel.
            reload();
            throw e;
          }
          toast.show('Demande annulée.', 'success');
          reload();
        }}
      >
        <p>La demande ne sera pas examinée. Vous pourrez en envoyer une nouvelle.</p>
      </ConfirmDialog>
    </section>
  );
}

function RequestForm({
  type,
  slug,
  current,
  reference,
  disabled,
  disabledReason,
  reload,
}: {
  type: EstablishmentType;
  slug: string;
  current: Values;
  reference: ReferenceData;
  disabled: boolean;
  disabledReason: string | null;
  reload: () => void;
}) {
  const [values, setValues] = useState<Values>(current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signal, setSignal] = useState(0);
  const { run, busy } = useAsyncAction();
  const toast = useToast();
  const fields = SENSITIVE_FIELDS[type];

  async function submit() {
    setMessage(null);
    setFormError(null);
    const changes: Record<string, unknown> = {};
    const found: Record<string, string> = {};
    for (const f of fields) {
      const next = (values[f] ?? '').trim();
      if (next === (current[f] ?? '').trim()) continue;
      if (f === 'name' && next === '') found[f] = 'Le nom est obligatoire.';
      else if (f === 'share_capital') {
        if (next !== '' && !/^\d+$/.test(next)) found[f] = 'Le capital social doit être un nombre entier positif.';
        else changes[f] = next === '' ? null : Number(next);
      } else if (f === 'force_type_id') {
        if (next === '') found[f] = 'Choisissez le type de structure.';
        else changes[f] = Number(next);
      } else changes[f] = next === '' ? null : next;
    }
    if (Object.keys(changes).length === 0 && Object.keys(found).length === 0) {
      found.changes = 'Modifiez au moins un champ avant d’envoyer la demande.';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSignal((n) => n + 1);
      return;
    }
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.createChangeRequest(type, slug, changes);
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      setMessage('Votre demande a été envoyée. Notre équipe va l’examiner.');
      toast.show('Demande envoyée.', 'success');
      reload();
    } else if (caught !== null) {
      const d = describeError(caught);
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.fields)) flat[k.replace(/^changes\./, '')] = v;
      setErrors(flat);
      setFormError(d.form);
      setSignal((n) => n + 1);
      // 409 : une demande existe déjà, on recharge pour l'afficher.
      if (caught instanceof ApiError && caught.status === 409) reload();
    }
  }

  const set = (f: string, v: string) => {
    setMessage(null);
    setValues((x) => ({ ...x, [f]: v }));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-lg font-semibold">Demander une modification</h3>
      {disabledReason ? <p className="text-muted">{disabledReason}</p> : null}
      <ErrorSummary errors={errors} focusSignal={signal} />
      <FormError message={formError} />
      <FormSuccess message={message} />
      <fieldset className="flex flex-col gap-4" disabled={disabled || busy}>
        <legend className="sr-only">Nouvelles valeurs des champs sensibles</legend>
        {fields.map((f) => {
          const label = FIELD_LABELS[f] ?? f;
          const error = errors[f];
          if (f === 'force_type_id') {
            return (
              <Select key={f} label={label} value={values[f] ?? ''} error={error} onChange={(e) => set(f, e.target.value)}>
                {reference.state_force_types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            );
          }
          if (f === 'corporate_purpose') {
            return (
              <Textarea key={f} label={label} rows={3} maxLength={1000} value={values[f] ?? ''} error={error} onChange={(e) => set(f, e.target.value)} />
            );
          }
          return (
            <Input
              key={f}
              label={label}
              value={values[f] ?? ''}
              error={error}
              maxLength={f === 'name' ? 255 : f === 'legal_form' ? 100 : 50}
              inputMode={f === 'share_capital' ? 'numeric' : undefined}
              onChange={(e) => set(f, e.target.value)}
            />
          );
        })}
      </fieldset>
      <div>
        <Button type="submit" loading={busy} disabled={disabled}>
          Envoyer la demande
        </Button>
      </div>
    </form>
  );
}
