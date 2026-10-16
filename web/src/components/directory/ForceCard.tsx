import Link from 'next/link';
import { Phone, Siren } from 'lucide-react';
import type { StateForceSummary } from '@/lib/api/types';
import { formatDistance, formatPhone, telHref } from '@/lib/format';
import { ficheActionClasses } from '../ui/FicheCard';
import { Badge } from '../ui/Tag';

/**
 * Fiche de force étatique v9 : bande de type en aplat bleu, nom en lien étiré, adresse,
 * disponibilité explicite, numéros d'urgence et standard en actions directes.
 */
export function ForceCard({ force }: { force: StateForceSummary }) {
  const distance = formatDistance(force.distance_m);
  const place = [force.district?.name, force.city.name].filter(Boolean).join(', ');
  return (
    <article className="group relative flex h-full flex-col border-2 border-ink bg-white text-ink transition-colors hover:bg-ink hover:text-white">
      <p className="flex items-center justify-between gap-3 bg-c1 px-[18px] py-2 eyebrow text-on-c1 group-hover:bg-c2 group-hover:text-on-c2">
        <span>{force.force_type.name}</span>
        {distance ? <span className="whitespace-nowrap">à {distance}</span> : null}
      </p>
      <div className="flex flex-1 flex-col gap-2 p-[18px]">
        <h3 className="text-[1.3rem] leading-tight font-extrabold tracking-[-0.01em]">
          <Link
            href={`/forces-etatiques/${force.slug}`}
            className="link-stretched text-inherit no-underline"
          >
            {force.name}
          </Link>
        </h3>
        <p className="text-[0.85rem] opacity-75">
          {place}
          {force.address ? (
            <>
              <br />
              {force.address}
            </>
          ) : null}
        </p>
        <p>
          {force.is_open_24h ? (
            <Badge tone="success">Ouvert 24 h/24</Badge>
          ) : (
            <Badge>Horaires limités</Badge>
          )}
        </p>
        {force.emergency_phone || force.phone ? (
          <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-2">
            {force.emergency_phone ? (
              <a href={telHref(force.emergency_phone)} className={ficheActionClasses}>
                <Siren aria-hidden="true" />
                Urgence : {force.emergency_phone}
              </a>
            ) : null}
            {force.phone ? (
              <a href={telHref(force.phone)} className={ficheActionClasses}>
                <Phone aria-hidden="true" />
                <span className="sr-only">Standard : </span>
                {formatPhone(force.phone)}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
