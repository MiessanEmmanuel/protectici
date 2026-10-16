import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { toneClasses, type Tone } from './tone';

interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Aplat de fond pleine largeur (t5 = blanc par défaut). */
  tone?: Tone;
  /** Contenu limité au conteneur 1200 px (par défaut) ; false = pleine largeur. */
  contained?: boolean;
  /** Espacement vertical : 72 px (défaut), aucun (`none`). */
  spacing?: 'default' | 'none';
  innerClassName?: string;
}

/** Section de page v9 : aplat pleine largeur + conteneur, 72 px d'espacement vertical. */
export function Section({
  tone = 't5',
  contained = true,
  spacing = 'default',
  className,
  innerClassName,
  children,
  ...rest
}: SectionProps) {
  return (
    <section className={cn(tone !== 't5' && toneClasses[tone], className)} {...rest}>
      <div
        className={cn(contained && 'wrap', spacing === 'default' && 'py-section', innerClassName)}
      >
        {children}
      </div>
    </section>
  );
}

interface SectionHeaderProps {
  id: string;
  title: ReactNode;
  /** Lien « voir plus » aligné à droite. */
  more?: { href: string; label: string };
  as?: 'h2' | 'h3';
  className?: string;
}

/** En-tête de section : grand titre 900 + lien « voir plus » avec flèche. */
export function SectionHeader({ id, title, more, as: H = 'h2', className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-7 flex flex-wrap items-end justify-between gap-x-5 gap-y-3', className)}>
      <H id={id} className="text-section heading-block">
        {title}
      </H>
      {more ? (
        <Link
          href={more.href}
          className="group inline-flex min-h-tap items-center gap-1.5 font-extrabold whitespace-nowrap text-inherit no-underline hover:underline"
        >
          {more.label}
          <ArrowRight
            aria-hidden="true"
            className="size-[1.15em] transition-transform group-hover:translate-x-1"
          />
        </Link>
      ) : null}
    </div>
  );
}
