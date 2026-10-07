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
    <p aria-live="polite" className="font-semibold">
      {total === 0 ? 'Aucun résultat' : `${total} ${total > 1 ? nouns : noun}`}
    </p>
  );
}

export function NoResults({ resetHref }: { resetHref: string }) {
  return (
    <EmptyState
      title="Aucun résultat ne correspond à votre recherche"
      action={
        <ButtonLink href={resetHref} variant="secondary">
          Effacer les filtres
        </ButtonLink>
      }
    >
      Vérifiez l’orthographe, retirez un filtre ou élargissez la zone de recherche.
    </EmptyState>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
