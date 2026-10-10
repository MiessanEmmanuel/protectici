'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminContactMessage, ContactStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { CONTACT_STATUS_LABELS } from '@/lib/labels';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { StatusPill } from '../../ui/StatusPill';
import { useToast } from '../../ui/Toast';
import { moderate } from '../avis/moderation';

export function AdminContactMessagesView() {
  const [status, setStatus] = useState<ContactStatus>('new');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<AdminContactMessage | null>(null);
  const [notice, setNotice] = useState('');
  const inflight = useRef(false);
  const action = useAsyncAction();
  const toast = useToast();
  const list = useResource(
    () => clientApi.adminListContactMessages({ status, ...(q ? { q } : {}), page }),
    [status, q, page],
  );

  function notify(message: string) {
    setNotice(message);
    toast.show(message, 'success');
  }
  const opts = (success: string) => ({
    success,
    conflict: 'Ce message a déjà été traité : la liste a été actualisée.',
    notFound: 'Ce message est introuvable : il a peut-être été supprimé.',
    notify,
    reload: list.reload,
  });

  async function setMessageStatus(m: AdminContactMessage, next: ContactStatus, success: string) {
    await action.run(() =>
      moderate(() => clientApi.adminUpdateContactMessage(m.id, next), opts(success)),
    );
  }

  async function reply(body?: string) {
    const current = replying;
    if (!current || inflight.current) return;
    inflight.current = true;
    try {
      await moderate(
        () => clientApi.adminReplyContactMessage(current.id, body ?? ''),
        opts('Réponse envoyée à l’auteur par e-mail.'),
      );
    } finally {
      inflight.current = false;
    }
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Messages de contact</h1>
      <p className="text-muted">Messages reçus depuis le formulaire de contact du site.</p>
      <form onSubmit={search} role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="Statut des messages"
          value={status}
          wrapperClassName="sm:w-64"
          onChange={(e) => {
            setStatus(e.target.value as ContactStatus);
            setPage(1);
          }}
        >
          {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => (
            <option key={s} value={s}>
              {s === 'new' ? 'Nouveaux' : CONTACT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          label="Nom, e-mail ou objet"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          wrapperClassName="sm:flex-1"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      <FormError message={action.error?.form} />

      <QueryBoundary state={list} loadingLabel="Chargement des messages…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun message">Aucun message ne correspond à ce filtre.</EmptyState>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {res.data.map((m) => (
                  <li key={m.id}>
                    <Card as="article" aria-labelledby={`msg-${m.id}`} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id={`msg-${m.id}`} className="text-lg font-bold break-words">
                            {m.subject}
                          </h2>
                          <p className="text-sm text-muted">
                            {m.name} ({m.email}) · {formatDateTime(m.created_at)}
                          </p>
                        </div>
                        <StatusPill kind="contact" status={m.status} />
                      </div>
                      <p className="whitespace-pre-line break-words">{m.message}</p>
                      {m.handled_by ? (
                        <p className="text-sm text-muted">
                          Traité par {m.handled_by.name}
                          {m.handled_at ? ` le ${formatDateTime(m.handled_at)}` : ''}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={action.busy}
                          onClick={() => setReplying(m)}
                          aria-label={`Répondre à ${m.name} : ${m.subject}`}
                        >
                          Répondre
                        </Button>
                        {m.status === 'new' ? (
                          <Button
                            variant="secondary"
                            loading={action.busy}
                            disabled={action.busy}
                            onClick={() => void setMessageStatus(m, 'read', 'Message marqué comme lu.')}
                            aria-label={`Marquer comme lu : ${m.subject}`}
                          >
                            Marquer comme lu
                          </Button>
                        ) : null}
                        {m.status !== 'archived' ? (
                          <Button
                            variant="secondary"
                            disabled={action.busy}
                            onClick={() => void setMessageStatus(m, 'archived', 'Message archivé.')}
                            aria-label={`Archiver : ${m.subject}`}
                          >
                            Archiver
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={action.busy}
                            onClick={() => void setMessageStatus(m, 'read', 'Message rétabli.')}
                            aria-label={`Rétablir : ${m.subject}`}
                          >
                            Rétablir
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <PagerButtons meta={res.meta} onPage={setPage} disabled={list.loading} />
            </>
          )
        }
      </QueryBoundary>

      <ConfirmDialog
        open={replying !== null}
        onClose={() => setReplying(null)}
        title="Répondre au message"
        confirmLabel="Envoyer la réponse"
        reasonLabel="Votre réponse"
        minReason={5}
        onConfirm={reply}
      >
        <p>
          Un e-mail sera envoyé à <strong>{replying?.name}</strong> ({replying?.email}) et le message
          passera au statut « Répondu ».
        </p>
      </ConfirmDialog>
    </div>
  );
}
