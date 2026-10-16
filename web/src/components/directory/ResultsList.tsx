import type { ReactNode } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { ButtonLink } from '../ui/Button';

export function ResultsCount({
  total,
  noun,
  nouns,
}: {
  total: number;
  noun: string;
  nouns: string;
}) {
  return (
    <p aria-live="polite" className="text-xl heading-block">
      {total === 0 ? 'Aucun résultat' : `${total} ${total > 1 ? nouns : noun}`}
    </p>
  );
}

export function NoResults({ resetHref }: { resetHref: string }) {
  return (
    <EmptyState
      title="Aucun résultat ne correspond à votre recherche"
      action={
        <ButtonLink href={resetHref} variant="solid">
          Effacer les filtres
        </ButtonLink>
      }
    >
      Vérifiez l’orthographe, retirez un filtre ou élargissez la zone de recherche.
    </EmptyState>
  );
}

/** Grille de résultats : fiches larges (prestataires) sur 2 colonnes, cartes (forces) sur 3. */
export function CardGrid({ children, dense }: { children: ReactNode; dense?: boolean }) {
  return (
    <ul
      className={dense ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 lg:grid-cols-2'}
    >
      {children}
    </ul>
  );
}
