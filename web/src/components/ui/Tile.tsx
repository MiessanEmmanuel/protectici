import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { toneClasses, type Tone } from './tone';

interface TileProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/** Aplat simple (bloc de couleur plein, sans bord ni ombre). */
export function Tile({ tone = 't5', className, children }: TileProps) {
  return <div className={cn(toneClasses[tone], 'p-8', className)}>{children}</div>;
}

interface TileLinkProps {
  href: string;
  tone?: Tone;
  /** Gros chiffre (compteur) facultatif, avec son unité. */
  figure?: { value: ReactNode; unit: ReactNode };
  label: ReactNode;
  /** Icône Lucide en haut à droite (tuiles de services uniquement). */
  icon?: ReactNode;
  className?: string;
}

/**
 * Tuile-lien de mosaïque : aplat coloré, chiffre en 900, libellé en bas, icône en haut à droite.
 * À placer dans une grille `grid-ruled` (filets 2 px).
 */
export function TileLink({ href, tone = 't5', figure, label, icon, className }: TileLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        toneClasses[tone],
        'group relative flex min-h-[140px] flex-col justify-between gap-4 p-5 no-underline md:min-h-[170px]',
        className,
      )}
    >
      {figure ? (
        <span className="block text-[2.1rem] leading-none font-black md:text-[2.6rem]">
          {figure.value}
          <small className="mt-1 block text-[0.8rem] font-bold tracking-normal opacity-85">
            {figure.unit}
          </small>
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-[1.05rem] leading-tight font-extrabold group-hover:underline">
        {label}
      </span>
      {icon ? (
        <span
          aria-hidden="true"
          className="absolute top-[18px] right-[18px] [&_svg]:size-9 [&_svg]:stroke-[1.75] md:[&_svg]:size-11"
        >
          {icon}
        </span>
      ) : null}
    </Link>
  );
}
