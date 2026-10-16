import type { ReactNode } from 'react';
import type { CommentStatus, PostStatus } from '@/lib/api/types';
import { cn } from '../../ui/cn';

/**
 * Briques de mise en page des écrans d'administration (maquette admin-v1).
 * Uniquement des jetons du thème admin (bg-white = panneau, bg-surface-alt = carte, border-line…),
 * redéfinis dans [data-admin-theme] : lisibles en mode sombre comme en mode clair.
 */

/** Panneau arrondi des filtres (à poser sur un <form role="search"> ou un <div>). */
export const FILTER_PANEL =
  'rounded-lg border border-line bg-white p-4 sm:p-5';

/** Disposition en ligne par défaut des filtres (champs alignés sur leur bas). */
export const FILTER_ROW = 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end';

export function FilterPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(FILTER_PANEL, FILTER_ROW, className)}>{children}</div>;
}

/** Bloc de formulaire arrondi : <fieldset> + légende (titre de section). */
export function FormSection({
  legend,
  description,
  children,
  className,
}: {
  legend: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('rounded-lg border border-line bg-white p-4 sm:p-5', className)}>
      {/* Légende flottante : posée dans la carte plutôt que sur son contour. */}
      <legend className="float-left mb-3 w-full text-base font-bold text-ink">{legend}</legend>
      <div className="clear-both flex flex-col gap-4">
        {description ? <p className="-mt-2 text-sm text-muted">{description}</p> : null}
        {children}
      </div>
    </fieldset>
  );
}

/** Carte arrondie générique (bloc de contenu de la maquette). */
export function Block({
  children,
  className,
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
  'aria-label'?: string;
}) {
  return (
    <Tag className={cn('rounded-lg border border-line bg-white p-4 sm:p-5', className)} {...rest}>
      {children}
    </Tag>
  );
}

export type DotTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
const DOT: Record<DotTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-c2',
  info: 'bg-primary',
  neutral: 'bg-muted',
};

/** Tonalité de la pastille par statut d'article. */
export const POST_TONES: Record<PostStatus, DotTone> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'success',
  archived: 'warning',
};

/** Tonalité de la pastille par statut de commentaire. */
export const COMMENT_TONES: Record<CommentStatus, DotTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  spam: 'danger',
};

/** Statut lisible : pilule texte + pastille de couleur (la couleur n'est jamais seule porteuse du sens). */
export function StatusDot({ tone = 'neutral', children }: { tone?: DotTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-alt px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[tone])} />
      {children}
    </span>
  );
}

/** Note d'information arrondie (lecture seule, rappel de règle). */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-md border border-line bg-surface-alt px-4 py-3 text-sm text-ink', className)}>
      {children}
    </div>
  );
}
