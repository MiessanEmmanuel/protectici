import type { ReactNode } from 'react';
import { cn } from './cn';

/** Étiquette neutre (service, type, ville). */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill bg-primary-soft px-3 py-0.5 text-sm text-primary-active',
        className,
      )}
    >
      {children}
    </span>
  );
}

type BadgeTone = 'success' | 'accent' | 'neutral' | 'danger';
const tones: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  accent: 'bg-accent text-on-accent',
  neutral: 'bg-surface-alt text-muted border border-line',
  danger: 'bg-danger-soft text-danger',
};

/** Pastille de statut (vérifié, à la une, 24 h/24…). Ne repose jamais sur la couleur seule : texte explicite. */
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
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
