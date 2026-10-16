import type { ElementType, HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * - `default` : bloc blanc à filet 2 px (v9) ; dans l'administration, panneau arrondi à filet discret.
 * - `subcard` : sous-carte arrondie sur fond alterné (bloc dans un panneau). Pensée pour
 *   l'administration (rayon --a-r-md) ; hors de la coquille admin, angles droits et fond sable.
 */
export type CardVariant = 'default' | 'subcard';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: CardVariant;
}

const variants: Record<CardVariant, string> = {
  default: 'ui-card border-2 border-ink bg-white p-4 sm:p-5',
  subcard: 'ui-subcard rounded-[var(--a-r-md,0)] border border-line bg-surface-alt p-4',
};

export function Card({ as: Tag = 'div', variant = 'default', className, ...rest }: CardProps) {
  return <Tag className={cn(variants[variant], className)} {...rest} />;
}
