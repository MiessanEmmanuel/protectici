import Link from 'next/link';
import { BadgeCheck, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface FicheCardProps {
  href: string;
  title: string;
  /** Logo (URL d'image de l'API) ; à défaut, monogramme sur aplat bleu. */
  logoUrl?: string | null;
  /** Ligne de métadonnées (ville, services…). */
  meta?: ReactNode;
  /** Mention « vérifiée » (texte explicite, badge icône). */
  verified?: ReactNode;
  /** Note moyenne sur 5 et nombre d'avis ; absent = pas de bloc note. */
  rating?: { value: string; count: ReactNode } | null;
  /** Distance formatée (« 1,4 km »). */
  distance?: string | null;
  /** Compléments sous les métadonnées (pastilles, tarif) ; facultatif. */
  extra?: ReactNode;
  /** Actions directes (Appeler, Demander un devis) : liens au-dessus du lien étiré. */
  actions?: ReactNode;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/**
 * Fiche d'annuaire v9 : monogramme 84 px, titre en lien étiré (toute la carte est cliquable),
 * note à droite, actions directes en dessous. Inversion encre/blanc au survol.
 * Empiler les fiches avec `-mt-0.5` (filets confondus) ou dans une liste `flex-col`.
 */
export function FicheCard({
  href,
  title,
  logoUrl,
  meta,
  verified,
  rating,
  distance,
  extra,
  actions,
  headingLevel: H = 'h3',
  className,
}: FicheCardProps) {
  return (
    <article
      className={cn(
        'group relative grid grid-cols-[56px_1fr] items-center gap-x-5 gap-y-2 border-2 border-ink bg-white p-[18px] text-ink transition-colors hover:bg-ink hover:text-white sm:grid-cols-[84px_1fr_auto]',
        className,
      )}
    >
      {logoUrl ? (
        // <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP stricte.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={84}
          height={84}
          loading="lazy"
          className="size-14 bg-white object-contain sm:size-[84px]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center bg-c1 text-[1.4rem] font-black text-on-c1 group-hover:bg-c2 group-hover:text-on-c2 sm:size-[84px] sm:text-[2rem]"
        >
          {title.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <H className="text-[1.35rem] leading-tight font-extrabold tracking-[-0.01em]">
          <Link href={href} className="link-stretched text-inherit no-underline">
            {title}
          </Link>
        </H>
        {meta ? <p className="mt-1 text-[0.85rem] opacity-75">{meta}</p> : null}
        {verified ? (
          <p className="mt-2 flex items-center gap-1.5 eyebrow text-[0.72rem] tracking-[0.08em]">
            <BadgeCheck
              aria-hidden="true"
              className="size-[1.4em] shrink-0 text-c1 group-hover:text-c2"
            />
            {verified}
          </p>
        ) : null}
        {distance ? <p className="mt-1.5 text-[0.78rem] font-extrabold">{distance}</p> : null}
        {extra ? <div className="mt-2">{extra}</div> : null}
      </div>
      {rating ? (
        <div className="col-start-2 sm:col-start-auto sm:text-right">
          <p className="flex items-center gap-1.5 text-[2.2rem] leading-none font-black sm:justify-end">
            <Star aria-hidden="true" className="size-[0.6em] fill-c2 stroke-c2" />
            <span>
              {rating.value}
              <span className="sr-only"> sur 5</span>
            </span>
          </p>
          <p className="text-xs opacity-75">{rating.count}</p>
        </div>
      ) : null}
      {actions ? (
        <div className="relative z-10 col-span-2 mt-1 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2 sm:col-end-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}

/** Action directe d'une fiche (Appeler, Demander un devis) : contour, passe à l'or au survol. */
export const ficheActionClasses =
  'relative z-10 inline-flex min-h-tap items-center gap-2 border-2 border-current bg-transparent px-3.5 text-[0.85rem] font-extrabold text-inherit no-underline hover:border-c2 hover:bg-c2 hover:text-on-c2 group-hover:border-white [&_svg]:size-[1.2em]';
