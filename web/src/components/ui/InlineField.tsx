import type { ReactNode } from 'react';
import { cn } from './cn';

const cellClasses =
  'block min-w-0 border-b-2 border-ink px-4 py-3 focus-within:bg-c4 focus-within:outline-3 focus-within:-outline-offset-4 focus-within:outline-ink lg:border-r-2 lg:border-b-0';
const captionClasses =
  'flex items-center gap-1.5 text-[0.7rem] font-extrabold tracking-[0.1em] text-ink-2 uppercase';

/**
 * Cellule de barre de recherche v9 (hero) : petit libellé en capitales au-dessus d'un champ sans
 * bordure ; fond sable au focus.
 * - Sans `htmlFor` : la cellule entière est le <label> (grande cible) ; le contrôle passé en
 *   enfant doit utiliser `inlineControlClasses`.
 * - Avec `htmlFor` : cellule <div> (positionnée) et libellé <label htmlFor> ; à utiliser pour un
 *   contrôle composé (liste déroulante conçue) qui ne doit pas être imbriqué dans un <label>. Le
 *   contrôle étire sa zone cliquable sur toute la cellule.
 */
export function InlineField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  if (htmlFor) {
    return (
      <div className={cn(cellClasses, 'relative', className)}>
        <label htmlFor={htmlFor} className={captionClasses}>
          {label}
        </label>
        {children}
      </div>
    );
  }
  return (
    <label className={cn(cellClasses, className)}>
      <span className={captionClasses}>{label}</span>
      {children}
    </label>
  );
}

export const inlineControlClasses =
  'w-full min-h-8 border-0 bg-transparent py-1 text-[1.05rem] text-ink outline-none placeholder:text-ink-2 focus-visible:shadow-none focus-visible:outline-none';
