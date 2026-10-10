'use client';

import { useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AdminFeedback, FeedbackReply, FeedbackStatus } from '@/lib/api/types';
import { formatDateTime, formatPhone } from '@/lib/format';
import {
  FEEDBACK_ACTION_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TARGET_LABELS,
} from '@/lib/labels';
import { newIdempotencyKey } from '@/lib/uuid';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormError, FormSuccess } from '../../ui/Field';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusPill } from '../../ui/StatusPill';
import { Textarea } from '../../ui/Textarea';
import { Badge } from '../../ui/Tag';
import { cn } from '../../ui/cn';

const MIN_REPLY = 5;

export function FeedbackDetail({
  id,
  onChanged,
  onClose,
}: {
  id: number;
  onChanged: () => void;
  onClose: () => void;
}) {
  const detail = useResource(() => clientApi.adminGetFeedback(id), [id]);
  const admins = useResource(() => clientApi.adminListUsers({ role: 'admin' }), []);
  const update = useAsyncAction();
  const [notice, setNotice] = useState<string | null>(null);

  async function patch(p: { status?: FeedbackStatus; assigned_to?: number | null }, message: string) {
    setNotice(null);
    const r = await update.run(async () => {
      try {
        await clientApi.adminUpdateFeedback(id, p);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          throw new ApiError(404, 'Ce dossier est introuvable : il a peut-être été supprimé.');
        }
        throw e;
      }
    });
    if (r.ok) setNotice(message);
    // Dans tous les cas (succès, 409, erreur), l’état affiché est resynchronisé avec le serveur.
    detail.reload();
    onChanged();
  }

  return (
    <QueryBoundary state={detail} loadingLabel="Chargement du dossier…">
      {(f) => (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Dossier {f.reference}</h2>
              <p className="text-sm text-muted">Reçu le {formatDateTime(f.created_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill kind="feedback" status={f.status} />
              <Button variant="ghost" onClick={onClose}>
                Fermer le dossier
              </Button>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Info label="Auteur">
              {[f.civility, f.author.first_name, f.author.last_name].filter(Boolean).join(' ')}
            </Info>
            <Info label="E-mail">{f.author.email}</Info>
            <Info label="Téléphone">{f.phone ? formatPhone(f.phone) : '—'}</Info>
            <Info label="Prestataire concerné">{f.provider?.name ?? '—'}</Info>
            <Info label="Type d’action">{FEEDBACK_ACTION_LABELS[f.action_type]}</Info>
            <Info label="Objet">{FEEDBACK_TARGET_LABELS[f.target_type]}</Info>
            <Info label="Service">{f.service_type?.name ?? '—'}</Info>
            <Info label="Sujet">{f.topic?.name ?? '—'}</Info>
            <Info label="Produit">{f.product_type ?? '—'}</Info>
            <Info label="Lieu">{f.location ?? '—'}</Info>
            <Info label="Consentement">Donné le {formatDateTime(f.consent_at)}</Info>
            <Info label="Résolution">
              {f.resolved_at ? `Résolu le ${formatDateTime(f.resolved_at)}` : 'Non résolu'}
            </Info>
          </dl>

          <div>
            <h3 className="font-semibold">Commentaire</h3>
            <p className="mt-1 whitespace-pre-line break-words">{f.comment}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Statut du dossier"
              value={f.status}
              disabled={update.busy}
              onChange={(e) => {
                const next = e.target.value as FeedbackStatus;
                void patch({ status: next }, `Statut mis à jour : ${FEEDBACK_STATUS_LABELS[next]}.`);
              }}
            >
              {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select
              label="Affecté à"
              value={f.assigned_to ? String(f.assigned_to.id) : ''}
              disabled={update.busy || admins.data === null}
              hint={admins.error ? 'La liste des administrateurs est indisponible.' : undefined}
              onChange={(e) => {
                const v = e.target.value;
                void patch(
                  { assigned_to: v ? Number(v) : null },
                  v ? 'Dossier affecté.' : 'Affectation retirée.',
                );
              }}
            >
              <option value="">Non affecté</option>
              {assignable(f, admins.data?.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <FormError message={update.error?.form} />
          <FormSuccess message={notice} />

          <Thread replies={f.replies} />
          <ReplyForm
            key={f.id}
            feedbackId={f.id}
            onSent={() => {
              detail.reload();
              onChanged();
            }}
          />
        </>
      )}
    </QueryBoundary>
  );
}

function assignable(f: AdminFeedback, admins: { id: number; first_name: string; last_name: string }[]) {
  const list = admins.map((a) => ({ id: a.id, name: `${a.first_name} ${a.last_name}`.trim() }));
  if (f.assigned_to && !list.some((a) => a.id === f.assigned_to!.id)) list.push(f.assigned_to);
  return list;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function Thread({ replies }: { replies: FeedbackReply[] }) {
  return (
    <section aria-labelledby="fil-reponses" className="flex flex-col gap-3">
      <h3 id="fil-reponses" className="font-semibold">
        Échanges ({replies.length})
      </h3>
      {replies.length === 0 ? (
        <p className="text-muted">Aucune réponse pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {replies.map((r) => (
            <li
              key={r.id}
              className={cn(
                'rounded-md border p-3',
                r.is_internal ? 'border-dashed border-line bg-surface-alt' : 'border-primary bg-surface',
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge tone={r.is_internal ? 'neutral' : 'success'}>
                  {r.is_internal ? 'Note interne (non envoyée à l’auteur)' : 'Envoyée à l’auteur'}
                </Badge>
                <span>
                  {r.author?.name ?? 'Administrateur'} · {formatDateTime(r.sent_at ?? r.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-line break-words">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReplyForm({ feedbackId, onSent }: { feedbackId: number; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Une clé par tentative logique : réutilisée au rejeu tant que le contenu est identique.
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const sending = useRef(false);
  const action = useAsyncAction();

  async function send() {
    if (sending.current) return;
    sending.current = true;
    try {
      const text = body.trim();
      const signature = `${internal ? 'i' : 'p'}:${text}`;
      if (!attempt.current || attempt.current.signature !== signature) {
        attempt.current = { signature, key: newIdempotencyKey() };
      }
      try {
        await clientApi.adminReplyFeedback(
          feedbackId,
          { body: text, is_internal: internal },
          attempt.current.key,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          throw new ApiError(404, 'Ce dossier est introuvable : il a peut-être été supprimé.');
        }
        throw e;
      }
      attempt.current = null;
      setDone(internal ? 'Note interne enregistrée.' : 'Réponse envoyée à l’auteur par e-mail.');
      setBody('');
      setInternal(false);
      onSent();
    } finally {
      sending.current = false;
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    if (body.trim().length < MIN_REPLY) {
      setFieldError(`La réponse doit contenir au moins ${MIN_REPLY} caractères.`);
      return;
    }
    setFieldError(null);
    if (internal) void action.run(send);
    else setConfirming(true);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label="Répondre au dossier">
      <h3 className="font-semibold">Répondre</h3>
      <Textarea
        label="Votre réponse"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={fieldError ?? undefined}
        maxLength={5000}
        required
        disabled={action.busy}
      />
      <Checkbox
        label="Note interne (non envoyée à l’auteur)"
        checked={internal}
        onChange={(e) => setInternal(e.target.checked)}
        disabled={action.busy}
      />
      <FormError message={action.error?.form} />
      <FormSuccess message={done} />
      <div>
        <Button type="submit" loading={action.busy} disabled={action.busy}>
          {internal ? 'Enregistrer la note' : 'Envoyer la réponse'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Envoyer la réponse à l’auteur"
        confirmLabel="Envoyer l’e-mail"
        onConfirm={send}
      >
        <p>Un e-mail contenant votre réponse sera envoyé à l’auteur du message. Il ne pourra pas être rappelé.</p>
      </ConfirmDialog>
    </form>
  );
}
