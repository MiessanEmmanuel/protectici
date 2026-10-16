import type { ReactNode } from 'react';
import { cn } from './cn';

/** Étiquette neutre (service, type, ville) : contour 2 px couleur courante, angles droits. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border-2 border-current px-2 py-0.5 text-sm font-bold',
        className,
      )}
    >
      {children}
    </span>
  );
}

type BadgeTone = 'success' | 'accent' | 'neutral' | 'danger' | 'primary' | 'night';
const tones: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  accent: 'bg-c2 text-on-c2',
  neutral: 'bg-c4 text-on-c4',
  danger: 'bg-danger-soft text-danger',
  primary: 'bg-c1 text-on-c1',
  night: 'bg-c3 text-on-c3',
};

/**
 * Pastille de statut en petites capitales (vérifié, à la une, 24 h/24…).
 * Ne repose jamais sur la couleur seule : le texte est toujours explicite.
 */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 eyebrow whitespace-nowrap [&_svg]:size-[1.3em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
