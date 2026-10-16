'use client';

import Link from 'next/link';
import { MessageSquareWarning, Search, Siren } from 'lucide-react';
import type { MouseEvent } from 'react';

/** Identifiant du champ de recherche principal de l'accueil (ciblé par « Rechercher »). */
export const HOME_SEARCH_INPUT_ID = 'recherche-service';

const item =
  'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[0.78rem] font-extrabold text-inherit no-underline [&_svg]:size-[22px]';

/**
 * Barre d'actions mobile (< 768 px), toujours au pouce : Rechercher / Urgences / Dis-moi tout.
 * « Rechercher » place le focus dans la recherche de l'accueil si elle est présente, sinon ouvre
 * l'annuaire (comportement de lien par défaut, donc fonctionnel sans JavaScript).
 */
export function MobileDock() {
  function onSearch(e: MouseEvent<HTMLAnchorElement>) {
    const input = document.getElementById(HOME_SEARCH_INPUT_ID);
    if (!input) return;
    e.preventDefault();
    input.scrollIntoView({ block: 'center' });
    input.focus({ preventScroll: true });
  }

  return (
    <nav
      aria-label="Actions rapides"
      className="fixed inset-x-0 bottom-0 z-[45] grid grid-cols-3 border-t-2 border-on-c3 bg-c3 text-on-c3 md:hidden"
    >
      <Link href="/annuaire" onClick={onSearch} className={item}>
        <Search aria-hidden="true" />
        Rechercher
      </Link>
      <Link href="/#urgence" className={`${item} bg-c2 text-on-c2`}>
        <Siren aria-hidden="true" />
        Urgences
      </Link>
      <Link href="/dis-moi-tout" className={`${item} border-l-2 border-white/20`}>
        <MessageSquareWarning aria-hidden="true" />
        Dis-moi tout
      </Link>
    </nav>
  );
}
