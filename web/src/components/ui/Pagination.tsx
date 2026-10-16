import Link from 'next/link';
import { cn } from './cn';

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  /** Construit l'URL d'une page (l'URL reste la source de vérité). */
  hrefFor: (page: number) => string;
  label?: string;
}

export function pageWindow(current: number, last: number, size = 5): number[] {
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(last, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const item =
  'inline-flex min-h-tap min-w-tap items-center justify-center border-2 px-3 font-extrabold no-underline';

export function Pagination({
  currentPage,
  lastPage,
  hrefFor,
  label = 'Pagination',
}: PaginationProps) {
  if (lastPage <= 1) return null;
  return (
    <nav aria-label={label} className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {currentPage > 1 ? (
            <Link
              href={hrefFor(currentPage - 1)}
              rel="prev"
              className={cn(item, 'border-ink bg-white text-ink hover:bg-ink hover:text-white')}
            >
              <span aria-hidden="true">‹&nbsp;</span>Précédent
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(item, 'border-ink-2 text-ink-2 opacity-60')}>
              <span aria-hidden="true">‹&nbsp;</span>Précédent
            </span>
          )}
        </li>
        {pageWindow(currentPage, lastPage).map((p) => (
          <li key={p}>
            {p === currentPage ? (
              <span aria-current="page" className={cn(item, 'border-ink bg-c2 text-on-c2')}>
                <span className="sr-only">Page </span>
                {p}
              </span>
            ) : (
              <Link
                href={hrefFor(p)}
                className={cn(item, 'border-ink bg-white text-ink hover:bg-ink hover:text-white')}
              >
                <span className="sr-only">Page </span>
                {p}
              </Link>
            )}
          </li>
        ))}
        <li>
          {currentPage < lastPage ? (
            <Link
              href={hrefFor(currentPage + 1)}
              rel="next"
              className={cn(item, 'border-ink bg-white text-ink hover:bg-ink hover:text-white')}
            >
              Suivant<span aria-hidden="true">&nbsp;›</span>
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(item, 'border-ink-2 text-ink-2 opacity-60')}>
              Suivant<span aria-hidden="true">&nbsp;›</span>
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
