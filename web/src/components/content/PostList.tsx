import type { Paginated, PostCard } from '@/lib/api/types';
import { buildHref } from '@/lib/search-params';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { PostCardItem } from './PostCardItem';
import { toneAt, type Tone } from '../ui/tone';

const TONES: Tone[] = ['t1', 't2', 't3'];

/** Grille d'articles paginée (navigation par liens : fonctionne sans JavaScript). */
export function PostList({
  result,
  basePath,
  q,
  emptyTitle = 'Aucun article ne correspond à votre recherche',
}: {
  result: Paginated<PostCard>;
  basePath: string;
  q?: string;
  emptyTitle?: string;
}) {
  if (result.data.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        Essayez d’autres mots-clés ou parcourez toutes les catégories.
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((p, i) => (
          <li key={p.slug} className="flex">
            <PostCardItem post={p} tone={toneAt(TONES, i)} />
          </li>
        ))}
      </ul>
      <Pagination
        currentPage={result.meta.current_page}
        lastPage={result.meta.last_page}
        hrefFor={(page) => buildHref(basePath, { q, page: page > 1 ? page : undefined })}
        label="Pagination des articles"
      />
    </>
  );
}
