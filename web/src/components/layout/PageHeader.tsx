import type { ReactNode } from 'react';
import { cn } from '../ui/cn';
import { toneClasses, type Tone } from '../ui/tone';

/**
 * En-tête de page intérieure v9 : aplat pleine largeur (bleu par défaut), petites capitales
 * facultatives, grand titre 900 serré, chapeau. `children` (fil d'Ariane, lien retour) s'affiche
 * au-dessus du titre ; leurs liens héritent de la couleur du ton (contraste garanti).
 */
export function PageHeader({
  title,
  intro,
  eyebrow,
  tone = 't1',
  children,
}: {
  title: string;
  intro?: ReactNode;
  eyebrow?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <div className={cn(toneClasses[tone], tone === 't5' && 'border-b-2 border-ink')}>
      <div className="wrap py-10 md:py-14 [&_a]:text-inherit">
        {children ? <div className="mb-5">{children}</div> : null}
        {eyebrow ? <p className="mb-3 eyebrow">{eyebrow}</p> : null}
        <h1 className="max-w-[22ch] text-section heading-block break-words">{title}</h1>
        {intro ? <p className="mt-4 max-w-[60ch] text-lg opacity-90">{intro}</p> : null}
      </div>
    </div>
  );
}
