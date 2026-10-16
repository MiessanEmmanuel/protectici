'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { ContentPostRow, PostStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { Button, ButtonLink } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { Badge } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { POST_STATUS_LABELS } from './labels';
import { AdminPageHeader } from '../AdminPageHeader';

/** Liste des articles (tous statuts) du back-office de contenu. */
export function AdminPostsView() {
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ContentPostRow | null>(null);
  const toast = useToast();
  const list = useResource(
    () => clientApi.contentListPosts({ ...(status ? { status } : {}), page }),
    [status, page],
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        section="Contenu"
        title="Articles du blog"
        actions={<ButtonLink href="/admin/blog/nouveau">Nouvel article</ButtonLink>}
      />
      <Select
        label="Filtrer par statut"
        value={status}
        wrapperClassName="sm:w-64"
        onChange={(e) => {
          setStatus(e.target.value as PostStatus | '');
          setPage(1);
        }}
      >
        <option value="">Tous les statuts</option>
        {(Object.keys(POST_STATUS_LABELS) as PostStatus[]).map((s) => (
          <option key={s} value={s}>
            {POST_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <QueryBoundary state={list} loadingLabel="Chargement des articles…">
        {(res) =>
          res.data.length === 0 ? (
            <EmptyState title="Aucun article" />
          ) : (
            <>
              <Table caption="Articles du blog">
                <THead>
                  <Tr>
                    <Th>Titre</Th>
                    <Th>Statut</Th>
                    <Th>Catégorie</Th>
                    <Th>Publication</Th>
                    <Th>Vues</Th>
                    <Th>Actions</Th>
                  </Tr>
                </THead>
                <tbody>
                  {res.data.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <Link href={`/admin/blog/${p.id}`} className="font-semibold">
                          {p.title}
                        </Link>
                        <div className="flex gap-1 pt-1">
                          {p.is_featured ? <Badge tone="accent">À la une</Badge> : null}
                          {p.is_flash ? <Badge>Flash info</Badge> : null}
                        </div>
                      </Td>
                      <Td>{POST_STATUS_LABELS[p.status]}</Td>
                      <Td>{p.category.name}</Td>
                      <Td>{p.published_at ? formatDateTime(p.published_at) : '—'}</Td>
                      <Td>{p.views_count}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <ButtonLink href={`/admin/blog/${p.id}`} variant="secondary" size="sm">
                            Modifier<span className="sr-only"> {p.title}</span>
                          </ButtonLink>
                          <Button variant="danger" size="sm" onClick={() => setToDelete(p)}>
                            Supprimer<span className="sr-only"> {p.title}</span>
                          </Button>
                        </div>
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
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer l’article"
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={async () => {
          if (!toDelete) return;
          await clientApi.contentDeletePost(toDelete.id);
          toast.show('Article supprimé.', 'success');
          list.reload();
        }}
      >
        <p>Supprimer « {toDelete?.title} » ? L’article ne sera plus visible sur le site.</p>
      </ConfirmDialog>
    </div>
  );
}
