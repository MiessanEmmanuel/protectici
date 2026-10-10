'use client';

import { useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QuoteStatus } from '@/lib/api/types';
import { formatDate, formatDateTime, formatFcfa, formatPhone } from '@/lib/format';
import { QUOTE_STATUS_LABELS } from '@/lib/labels';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormError, FormSuccess } from '../../ui/Field';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusPill } from '../../ui/StatusPill';
import { AdminProviderPicker, type PickedProviderId } from './AdminProviderPicker';

const NOT_FOUND = 'Cette demande est introuvable : elle a peut-être été supprimée.';

export function QuoteDetail({
  id,
  onChanged,
  onClose,
}: {
  id: number;
  onChanged: () => void;
  onClose: () => void;
}) {
  const detail = useResource(() => clientApi.adminGetQuote(id), [id]);
  const update = useAsyncAction();
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedProviderId[]>([]);
  const [confirming, setConfirming] = useState(false);
  const dispatching = useRef(false);

  async function changeStatus(status: QuoteStatus) {
    setNotice(null);
    const r = await update.run(async () => {
      try {
        await clientApi.adminUpdateQuoteStatus(id, status);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) throw new ApiError(404, NOT_FOUND);
        throw e;
      }
    });
    if (r.ok) setNotice(`Statut mis à jour : ${QUOTE_STATUS_LABELS[status]}.`);
    detail.reload();
    onChanged();
  }

  async function dispatch() {
    if (dispatching.current) return;
    dispatching.current = true;
    try {
      try {
        await clientApi.adminDispatchQuote(
          id,
          picked.map((p) => p.id),
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) throw new ApiError(404, NOT_FOUND);
        throw e;
      }
      setNotice(
        `Demande acheminée à ${picked.length} prestataire${picked.length > 1 ? 's' : ''} : un e-mail leur a été envoyé.`,
      );
      setPicked([]);
      detail.reload();
      onChanged();
    } finally {
      dispatching.current = false;
    }
  }

  return (
    <QueryBoundary state={detail} loadingLabel="Chargement de la demande…">
      {(q) => (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Demande {q.reference}</h2>
              <p className="text-sm text-muted">Reçue le {formatDateTime(q.created_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill kind="quote" status={q.status} />
              <Button variant="ghost" onClick={onClose}>
                Fermer la demande
              </Button>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Info label="Demandeur">{q.requester_name}</Info>
            <Info label="E-mail">{q.requester_email}</Info>
            <Info label="Téléphone">{formatPhone(q.phone)}</Info>
            <Info label="Entreprise">{q.company_name ?? '—'}</Info>
            <Info label="Service">{q.service.name}</Info>
            <Info label="Ville">{q.city.name}</Info>
            <Info label="Début souhaité">
              {q.desired_start_date ? formatDate(q.desired_start_date) : '—'}
            </Info>
            <Info label="Budget">{q.budget_range ?? '—'}</Info>
          </dl>
          <div>
            <h3 className="font-semibold">Besoin exprimé</h3>
            <p className="mt-1 whitespace-pre-line break-words">{q.description}</p>
          </div>

          <Select
            label="Statut de la demande"
            value={q.status}
            disabled={update.busy}
            wrapperClassName="max-w-xs"
            onChange={(e) => void changeStatus(e.target.value as QuoteStatus)}
          >
            {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <FormError message={update.error?.form} />
          <FormSuccess message={notice} />

          <section aria-labelledby="destinataires" className="flex flex-col gap-3">
            <h3 id="destinataires" className="font-semibold">
              Destinataires ({q.recipients.length})
            </h3>
            {q.recipients.length === 0 ? (
              <p className="text-muted">Cette demande n’a encore été transmise à aucun prestataire.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {q.recipients.map((r) => (
                  <li key={r.id} className="rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{r.provider.name}</p>
                      <StatusPill kind="recipient" status={r.status} />
                    </div>
                    <p className="text-sm text-muted">
                      Envoyée le {formatDateTime(r.sent_at)}
                      {r.viewed_at ? ` · consultée le ${formatDateTime(r.viewed_at)}` : ''}
                      {r.replied_at ? ` · répondue le ${formatDateTime(r.replied_at)}` : ''}
                    </p>
                    {r.response_message ? (
                      <p className="mt-2 whitespace-pre-line break-words">{r.response_message}</p>
                    ) : null}
                    {r.quoted_amount !== null ? (
                      <p className="mt-1 font-semibold">Montant proposé : {formatFcfa(r.quoted_amount)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="acheminer" className="flex flex-col gap-3">
            <h3 id="acheminer" className="font-semibold">
              Acheminer à des prestataires
            </h3>
            <p className="text-sm text-muted">
              Choisissez de 1 à 5 prestataires publiés. Ceux qui sont déjà destinataires sont exclus.
            </p>
            <AdminProviderPicker
              selected={picked}
              onChange={setPicked}
              excludeIds={q.recipients.map((r) => r.provider.id)}
              max={5}
            />
            <div>
              <Button disabled={picked.length === 0} onClick={() => setConfirming(true)}>
                Acheminer la demande
              </Button>
            </div>
          </section>
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title="Acheminer la demande"
            confirmLabel="Acheminer et envoyer les e-mails"
            onConfirm={dispatch}
          >
            <p>
              Un e-mail sera envoyé à chaque prestataire choisi ({picked.map((p) => p.name).join(', ')}
              ). Les coordonnées du demandeur leur seront visibles.
            </p>
          </ConfirmDialog>
        </>
      )}
    </QueryBoundary>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
