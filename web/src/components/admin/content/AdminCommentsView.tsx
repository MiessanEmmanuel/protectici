'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { CommentStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { COMMENT_STATUS_LABELS } from './labels';
import { AdminPageHeader } from '../AdminPageHeader';

/** Modération des commentaires du blog (texte brut affiché tel quel, jamais interprété comme HTML). */
export function AdminCommentsView() {
  const [status, setStatus] = useState<CommentStatus>('pending');
  const [page, setPage] = useState(1);
  const toast = useToast();
  const action = useAsyncAction();
  const list = useResource(() => clientApi.contentListComments({ status, page }), [status, page]);

  async function moderate(id: number, next: Exclude<CommentStatus, 'pending'>, msg: string) {
    const r = await action.run(() => clientApi.contentModerateComment(id, next));
    if (r.ok) {
      toast.show(msg, 'success');
      list.reload();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Contenu" title="Commentaires du blog" />
      <Select
        label="Statut"
        value={status}
        wrapperClassName="sm:w-64"
        onChange={(e) => {
          setStatus(e.target.value as CommentStatus);
          setPage(1);
        }}
      >
        {(Object.keys(COMMENT_STATUS_LABELS) as CommentStatus[]).map((s) => (
          <option key={s} value={s}>{COMMENT_STATUS_LABELS[s]}</option>
        ))}
      </Select>
      <FormError message={action.error?.form} />
      <QueryBoundary state={list} loadingLabel="Chargement des commentaires…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun commentaire dans cet état" />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {res.data.map((c) => (
                  <li key={c.id}>
                    <Card className="flex flex-col gap-2">
                      <p className="text-sm text-muted">
                        <strong className="text-ink">{c.author_name}</strong> sur « {c.post.title} » ·{' '}
                        <time dateTime={c.created_at}>{formatDateTime(c.created_at)}</time>
                      </p>
                      <p className="whitespace-pre-line">{c.body}</p>
                      <div className="flex flex-wrap gap-2">
                        {c.status !== 'approved' ? (
                          <Button size="sm" disabled={action.busy} onClick={() => void moderate(c.id, 'approved', 'Commentaire approuvé.')}>
                            Approuver<span className="sr-only"> le commentaire de {c.author_name}</span>
                          </Button>
                        ) : null}
                        {c.status !== 'rejected' ? (
                          <Button size="sm" variant="secondary" disabled={action.busy} onClick={() => void moderate(c.id, 'rejected', 'Commentaire rejeté.')}>
                            Rejeter<span className="sr-only"> le commentaire de {c.author_name}</span>
                          </Button>
                        ) : null}
                        {c.status !== 'spam' ? (
                          <Button size="sm" variant="danger" disabled={action.busy} onClick={() => void moderate(c.id, 'spam', 'Commentaire marqué comme indésirable.')}>
                            Indésirable<span className="sr-only"> : commentaire de {c.author_name}</span>
                          </Button>
                        ) : null}
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
    </div>
  );
}
