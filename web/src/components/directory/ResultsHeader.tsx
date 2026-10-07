import Link from 'next/link';
import { cn } from '../ui/cn';

export function ViewToggle({
  listHref,
  mapHref,
  view,
}: {
  listHref: string;
  mapHref: string;
  view: 'list' | 'map';
}) {
  const base =
    'inline-flex min-h-tap items-center px-4 no-underline first:rounded-l-md last:rounded-r-md border border-primary';
  return (
    <nav aria-label="Mode d’affichage" className="inline-flex">
      <Link
        href={listHref}
        aria-current={view === 'list' ? 'page' : undefined}
        className={cn(
          base,
          view === 'list'
            ? 'bg-primary font-semibold text-on-primary'
            : 'bg-surface text-primary hover:bg-primary-soft',
        )}
      >
        Liste
      </Link>
      <Link
        href={mapHref}
        aria-current={view === 'map' ? 'page' : undefined}
        className={cn(
          base,
          '-ml-px',
          view === 'map'
            ? 'bg-primary font-semibold text-on-primary'
            : 'bg-surface text-primary hover:bg-primary-soft',
        )}
      >
        Carte
      </Link>
    </nav>
  );
}
