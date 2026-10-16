import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Cellule de barre de recherche v9 (hero) : petit libellé en capitales au-dessus d'un champ sans
 * bordure ; la cellule entière est le <label> (grande cible), fond sable au focus.
 * Le contrôle passé en enfant doit utiliser `inlineControlClasses`.
 */
export function InlineField({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        'block min-w-0 border-b-2 border-ink px-4 py-3 focus-within:bg-c4 focus-within:outline-3 focus-within:-outline-offset-4 focus-within:outline-ink lg:border-r-2 lg:border-b-0',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[0.7rem] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inlineControlClasses =
  'w-full min-h-8 border-0 bg-transparent py-1 text-[1.05rem] text-ink outline-none placeholder:text-ink-2 focus-visible:shadow-none focus-visible:outline-none';
