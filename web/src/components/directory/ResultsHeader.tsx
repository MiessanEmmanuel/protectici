import Link from 'next/link';
import { List, Map as MapIcon } from 'lucide-react';
import { cn } from '../ui/cn';

/** Bascule liste / carte : deux liens (l'URL reste la source de vérité), filet 2 px. */
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
    'inline-flex min-h-tap items-center gap-2 px-4 font-extrabold no-underline [&_svg]:size-[1.15em]';
  const on = 'bg-ink text-white';
  const off = 'bg-white text-ink hover:bg-c4';
  return (
    <nav aria-label="Mode d’affichage" className="inline-flex border-2 border-ink">
      <Link
        href={listHref}
        aria-current={view === 'list' ? 'page' : undefined}
        className={cn(base, view === 'list' ? on : off)}
      >
        <List aria-hidden="true" />
        Liste
      </Link>
      <Link
        href={mapHref}
        aria-current={view === 'map' ? 'page' : undefined}
        className={cn(base, 'border-l-2 border-ink', view === 'map' ? on : off)}
      >
        <MapIcon aria-hidden="true" />
        Carte
      </Link>
    </nav>
  );
}
