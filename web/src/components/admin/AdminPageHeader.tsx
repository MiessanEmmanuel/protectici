import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

/**
 * En-tête de page de travail (administration, espace prestataire) : sobre et dense.
 * Libellé de rubrique en petites capitales, titre, description courte, actions alignées à droite,
 * posé sur un filet. Dans l'administration (data-admin-theme), le filet devient discret (1 px,
 * couleur --a-line) et les actions sont des pilules (styles/admin.css) ; ailleurs, style v9 inchangé.
 */
export function AdminPageHeader({
  title,
  section,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  /** Rubrique au-dessus du titre (ex. « Contenu », « Modération »). */
  section?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Pastilles de statut ou informations courtes sous le titre. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'admin-page-header flex flex-col gap-3 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {section ? <p className="eyebrow text-ink-2">{section}</p> : null}
        <h1 className="text-2xl break-words heading-block sm:text-[2rem]">{title}</h1>
        {meta ? <div className="flex flex-wrap items-center gap-1.5 pt-1">{meta}</div> : null}
        {description ? <div className="max-w-prose text-ink-2">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
