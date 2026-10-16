import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../ui/cn';

/**
 * Briques de présentation des écrans de modération (établissements, modifications, avis),
 * maquette admin-v1 : panneaux arrondis à filet 1 px, cartes internes sur fond « carte ».
 * Uniquement des jetons du thème (redéfinis par [data-admin-theme]) : lisibles en sombre et en clair.
 */

/** Panneau de filtres (formulaire de recherche) : arrondi, fond panneau, filet discret. */
export const filterPanelClasses = 'grid gap-4 rounded-lg border border-line bg-white p-4 sm:p-5';

/** Carte d'élément de file (demande, avis, signalement) : article arrondi. */
export const itemCardClasses =
  'ui-card flex flex-col gap-4 rounded-lg border border-line bg-white p-4 sm:p-6';

/** Carte interne (élément de liste, document, demande) posée dans un panneau. */
export const insetClasses = 'rounded-md border border-line bg-surface-alt p-3 sm:p-4';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: ElementType;
  title?: ReactNode;
  titleId?: string;
  /** Texte court à droite du titre (compteur, lien « voir tout »). */
  aside?: ReactNode;
  /** Sous-titre discret sous le titre. */
  hint?: ReactNode;
}

/** Bloc de contenu arrondi (« block » de la maquette) avec en-tête facultatif. */
export function Panel({
  as: Tag = 'section',
  title,
  titleId,
  aside,
  hint,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag
      className={cn(
        'ui-card flex flex-col gap-4 rounded-lg border border-line bg-white p-4 sm:p-6',
        className,
      )}
      {...rest}
    >
      {title ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-lg font-bold break-words">
              {title}
            </h2>
            {hint ? <p className="text-sm text-muted">{hint}</p> : null}
          </div>
          {aside ? <div className="text-sm text-muted">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/** Ligne libellé / valeur d'une fiche de détail. */
export function DefRow({ label, children }: { label: string; children: ReactNode }) {
  const empty =
    children === null || children === undefined || children === '' || children === false;
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="break-words">
        {empty ? <span className="text-muted">Non renseigné</span> : children}
      </dd>
    </div>
  );
}

/** Liste de définitions à séparateurs fins. */
export function DefList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col divide-y divide-line-soft">{children}</dl>;
}

/** Note discrète (avertissement de confidentialité, aide). */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-surface-alt px-3 py-2 text-sm text-muted">{children}</p>;
}
