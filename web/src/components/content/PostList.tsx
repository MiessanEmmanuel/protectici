import type { Paginated, PostCard } from '@/lib/api/types';
import { buildHref } from '@/lib/search-params';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { PostCardItem } from './PostCardItem';

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
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((p) => (
          <li key={p.slug}>
            <PostCardItem post={p} />
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
