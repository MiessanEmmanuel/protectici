'use client';

import { clientApi } from '@/lib/api/client';
import { useResource } from '@/lib/use-async';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { PostEditor } from './PostEditor';

export function EditPostLoader({ id }: { id: number }) {
  const state = useResource(() => clientApi.contentGetPost(id), [id]);
  return (
    <QueryBoundary state={state} loadingLabel="Chargement de l’article…">
      {(post) => <PostEditor key={post.id} post={post} />}
    </QueryBoundary>
  );
}
