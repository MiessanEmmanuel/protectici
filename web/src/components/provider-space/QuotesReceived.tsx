'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage, firstFieldErrors } from '@/lib/api/errors';
import type { Paginated, ProviderQuote, QuoteRecipientStatus } from '@/lib/api/types';
import { formatDate, formatFcfa } from '@/lib/format';
import { QUOTE_RECIPIENT_STATUS_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { validate } from '@/lib/validation';
import { quoteReplySchema } from '@/lib/wave-b-schemas';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';
import { PagerButtons } from '../ui/PagerButtons';
import { QueryBoundary } from '../ui/QueryBoundary';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';
import { Table, Td, Th, THead, Tr } from '../ui/Table';
import { Textarea } from '../ui/Textarea';

const STATUSES: QuoteRecipientStatus[] = ['sent', 'viewed', 'replied', 'declined'];

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function QuotesReceived() {
  const [status, setStatus] = useState<'' | QuoteRecipientStatus>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const list = useResource(
    () => clientApi.listMyQuotes({ status: status || undefined, page }),
    [status, page],
  );
  const counts = useResource(async () => {
    const res = await Promise.all(STATUSES.map((s) => clientApi.listMyQuotes({ status: s })));
    return STATUSES.map((s, i) => [s, res[i]!.meta.total] as const);
  }, []);

  const forbidden = list.data === null && list.error?.status === 403;

  /** Remplace une ligne de la liste par sa version à jour (statut « Consulté », « Répondu »…). */
  function patchRow(q: ProviderQuote) {
    const cur: Paginated<ProviderQuote> | null = list.data;
    if (!cur) return;
    list.setData({ ...cur, data: cur.data.map((r) => (r.id === q.id ? q : r)) });
  }

  if (forbidden) {
    return (
      <EmptyState
        title="Aucune fiche prestataire rattachée à votre compte"
        action={<ButtonLink href="/inscription-etablissement">Inscrire mon établissement</ButtonLink>}
      >
        Les devis sont réservés aux propriétaires d’une fiche prestataire. Inscrivez votre entreprise pour en recevoir.
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="quotes-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="quotes-title" className="text-xl font-bold">
            Demandes de devis
          </h2>
          {counts.data ? (
            <ul className="flex flex-wrap gap-x-4 text-muted" aria-label="Nombre de devis par statut">
              {counts.data.map(([s, n]) => (
                <li key={s}>
                  {QUOTE_RECIPIENT_STATUS_LABELS[s]} : <strong>{n}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Select
          label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | QuoteRecipientStatus);
            setPage(1);
          }}
        >
          <option value="">Tous</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'sent' ? 'Reçus' : s === 'viewed' ? 'Consultés' : s === 'replied' ? 'Répondus' : 'Déclinés'}
            </option>
          ))}
        </Select>
      </div>
      <FormSuccess message={notice?.kind === 'ok' ? notice.text : null} />
      <FormError message={notice?.kind === 'error' ? notice.text : null} />
      <QueryBoundary state={list} loadingLabel="Chargement des devis…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun devis">Aucune demande de devis ne correspond à ce filtre.</EmptyState>
          ) : (
            <div>
              <Table caption="Devis reçus">
                <THead>
                  <tr>
                    <Th>Référence</Th>
                    <Th>Demandeur</Th>
                    <Th>Service</Th>
                    <Th>Ville</Th>
                    <Th>Reçu le</Th>
                    <Th>Statut</Th>
                    <Th>Montant proposé</Th>
                    <Th>
                      <span className="sr-only">Action</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {res.data.map((q) => (
                    <Tr key={q.id}>
                      <Td className="font-semibold">{q.reference}</Td>
                      <Td>{q.requester.name}</Td>
                      <Td>{q.service.name}</Td>
                      <Td>{q.city.name}</Td>
                      <Td>{formatDate(q.sent_at)}</Td>
                      <Td>
                        <StatusPill kind="recipient" status={q.status} />
                      </Td>
                      <Td>{q.status === 'replied' && q.quoted_amount !== null ? formatFcfa(q.quoted_amount) : '—'}</Td>
                      <Td>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Ouvrir le devis ${q.reference}`}
                          aria-expanded={openId === q.id}
                          onClick={() => setOpenId(q.id)}
                        >
                          Ouvrir
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={res.meta} onPage={setPage} />
            </div>
          )
        }
      </QueryBoundary>
      {openId !== null ? (
        <QuoteDetail
          key={openId}
          id={openId}
          onUpdated={(q) => {
            patchRow(q);
            counts.reload();
          }}
          onReload={() => {
            list.reload();
            counts.reload();
          }}
          onNotice={setNotice}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function QuoteDetail({
  id,
  onUpdated,
  onReload,
  onNotice,
  onClose,
}: {
  id: number;
  onUpdated: (q: ProviderQuote) => void;
  onReload: () => void;
  onNotice: (n: Notice) => void;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState<ProviderQuote | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [mode, setMode] = useState<'reply' | null>(null);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReply, setConfirmReply] = useState<{ message: string; quoted_amount: number | null } | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef({ onUpdated, onNotice });
  useEffect(() => {
    callbacks.current = { onUpdated, onNotice };
  });

  useEffect(() => {
    let active = true;
    clientApi
      .getMyQuote(id)
      .then((q) => {
        if (!active) return;
        setQuote(q);
        callbacks.current.onUpdated(q);
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof ApiError ? e : new ApiError(500, errorMessage(e)));
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (quote) heading.current?.focus();
  }, [quote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Exécute une action d’écriture ; gère 409, 404 et 403 avec un message clair. */
  async function act(fn: () => Promise<void>, success: string) {
    if (sending.current) return;
    sending.current = true;
    try {
      await fn();
      onNotice({ kind: 'ok', text: success });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        onNotice({ kind: 'error', text: 'Cette demande a déjà reçu une réponse. Les données ont été actualisées.' });
      } else if (e instanceof ApiError && e.status === 404) {
        onNotice({ kind: 'error', text: 'Cette demande de devis n’est plus disponible.' });
        onReload();
        onClose();
        return;
      } else if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        return;
      } else if (e instanceof ApiError && e.status === 422) {
        setErrors(firstFieldErrors(e));
        return;
      } else {
        throw e;
      }
    } finally {
      sending.current = false;
    }
    try {
      const fresh = await clientApi.getMyQuote(id);
      setQuote(fresh);
      onUpdated(fresh);
    } catch {
      onReload();
    }
    setMode(null);
  }

  function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(quoteReplySchema, { message, quoted_amount: amount });
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setConfirmReply({ message: v.data.message, quoted_amount: v.data.quoted_amount });
  }

  if (forbidden) {
    return (
      <EmptyState
        title="Action non autorisée"
        action={<ButtonLink href="/inscription-etablissement">Inscrire mon établissement</ButtonLink>}
      >
        Vous n’êtes pas propriétaire d’une fiche destinataire de cette demande.
      </EmptyState>
    );
  }
  if (loadError) {
    return (
      <Card>
        <FormError message={loadError.message} />
        <div className="mt-3">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </Card>
    );
  }
  if (!quote) return <p role="status">Chargement du devis…</p>;

  const open = quote.status === 'sent' || quote.status === 'viewed';
  const place = [quote.district?.name, quote.city.name].filter(Boolean).join(', ');
  const tel = quote.requester.phone.replace(/[^\d+]/g, '');

  return (
    <Card as="section" aria-labelledby="quote-detail-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="quote-detail-title" ref={heading} tabIndex={-1} className="text-lg font-bold">
            Devis {quote.reference}
          </h3>
          <p className="mt-1">
            <StatusPill kind="recipient" status={quote.status} />
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Fermer le détail
        </Button>
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Item label="Demandeur">{quote.requester.name}</Item>
        <Item label="Entreprise">{quote.requester.company_name ?? '—'}</Item>
        <Item label="E-mail">
          <a href={`mailto:${quote.requester.email}`}>{quote.requester.email}</a>
        </Item>
        <Item label="Téléphone">
          <a href={`tel:${tel}`}>{quote.requester.phone}</a>
        </Item>
        <Item label="Service demandé">{quote.service.name}</Item>
        <Item label="Lieu">{place}</Item>
        <Item label="Date souhaitée">
          {quote.desired_start_date ? formatDate(quote.desired_start_date) : 'Non précisée'}
        </Item>
        <Item label="Budget indicatif">{quote.budget_range ?? 'Non précisé'}</Item>
        <Item label="Reçu le">{formatDate(quote.sent_at)}</Item>
      </dl>
      <div>
        <h4 className="font-semibold">Description</h4>
        <p className="whitespace-pre-line">{quote.description}</p>
      </div>

      {quote.status === 'replied' ? (
        <div className="rounded-md border-l-4 border-primary bg-surface-alt p-3">
          <p className="font-semibold">
            Votre réponse{quote.replied_at ? ` du ${formatDate(quote.replied_at)}` : ''}
          </p>
          <p className="whitespace-pre-line">{quote.response_message}</p>
          <p className="mt-1">
            Montant proposé :{' '}
            <strong>{quote.quoted_amount !== null ? formatFcfa(quote.quoted_amount) : 'non précisé'}</strong>
          </p>
        </div>
      ) : null}

      {open && mode === null ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setMode('reply')}>Répondre</Button>
          <Button variant="danger" onClick={() => setConfirmDecline(true)}>
            Décliner
          </Button>
        </div>
      ) : null}

      {open && mode === 'reply' ? (
        <form onSubmit={submitReply} noValidate className="flex flex-col gap-3">
          <Textarea
            label="Votre message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            error={errors.message}
            maxLength={3000}
            hint={`10 à 3 000 caractères (${message.trim().length}/3000). Une seule réponse est possible.`}
            rows={5}
          />
          <Input
            label="Montant proposé (FCFA)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.quoted_amount}
            inputMode="numeric"
            autoComplete="off"
            hint="Facultatif. Nombre entier, sans décimales."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Envoyer la réponse</Button>
            <Button variant="secondary" onClick={() => setMode(null)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmReply !== null}
        onClose={() => setConfirmReply(null)}
        title="Confirmer votre réponse"
        confirmLabel="Envoyer la réponse"
        onConfirm={async () => {
          if (!confirmReply) return;
          const input = confirmReply;
          await act(
            () =>
              clientApi.replyToQuote(id, {
                message: input.message,
                ...(input.quoted_amount !== null ? { quoted_amount: input.quoted_amount } : {}),
              }),
            'Votre réponse a été envoyée au demandeur.',
          );
        }}
      >
        <p>Une seule réponse est possible et elle ne pourra plus être modifiée.</p>
        {confirmReply?.quoted_amount != null ? (
          <p className="mt-2">Montant proposé : {formatFcfa(confirmReply.quoted_amount)}</p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDecline}
        onClose={() => setConfirmDecline(false)}
        title="Décliner cette demande"
        confirmLabel="Décliner la demande"
        tone="danger"
        onConfirm={async () => {
          const reason = declineReason.trim();
          await act(() => clientApi.declineQuote(id, reason || undefined), 'La demande a été déclinée.');
        }}
      >
        <p>Le demandeur ne recevra pas de réponse de votre part.</p>
        <Textarea
          label="Motif (facultatif)"
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          maxLength={1000}
          rows={3}
          wrapperClassName="mt-3"
        />
      </ConfirmDialog>
    </Card>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="whitespace-pre-line break-words">{children}</dd>
    </div>
  );
}
