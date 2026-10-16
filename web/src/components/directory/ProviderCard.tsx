import Link from 'next/link';
import { Phone } from 'lucide-react';
import type { ProviderSummary } from '@/lib/api/types';
import { buildHref } from '@/lib/search-params';
import { formatDistance, formatFcfa, formatPhone, formatRating, telHref } from '@/lib/format';
import { FicheCard, ficheActionClasses } from '../ui/FicheCard';
import { Badge } from '../ui/Tag';

/** Fiche de résultat d'annuaire (système v9 : FicheCard + actions directes). */
export function ProviderCard({ provider }: { provider: ProviderSummary }) {
  const distance = formatDistance(provider.distance_m);
  const place = [provider.district?.name, provider.city.name].filter(Boolean).join(', ');
  const services = provider.services.slice(0, 3).map((s) => s.name);
  const more = provider.services.length - services.length;
  return (
    <FicheCard
      href={`/annuaire/${provider.slug}`}
      className="h-full"
      title={provider.name}
      logoUrl={provider.logo_url}
      meta={
        <>
          {place}
          {services.length > 0 ? (
            <>
              {' · '}
              <span className="sr-only">Services proposés : </span>
              {services.join(', ')}
              {more > 0 ? ` +${more}` : null}
            </>
          ) : null}
        </>
      }
      verified={provider.is_verified ? 'Fiche vérifiée' : null}
      rating={
        provider.rating_count > 0
          ? {
              value: formatRating(provider.rating_avg),
              count: `${provider.rating_count} avis`,
            }
          : null
      }
      distance={distance ? `à ${distance}` : null}
      extra={
        <p className="flex flex-wrap items-center gap-2 text-[0.85rem] font-bold">
          {provider.is_featured ? <Badge tone="accent">À la une</Badge> : null}
          <span>
            {provider.price_from
              ? `À partir de ${formatFcfa(provider.price_from)}`
              : 'Tarif sur devis'}
          </span>
        </p>
      }
      actions={
        <>
          {provider.phone ? (
            <a href={telHref(provider.phone)} className={ficheActionClasses}>
              <Phone aria-hidden="true" />
              <span className="sr-only">Appeler {provider.name} : </span>
              {formatPhone(provider.phone)}
            </a>
          ) : null}
          <Link
            href={buildHref('/devis', { prestataire: provider.slug })}
            className={ficheActionClasses}
          >
            Demander un devis<span className="sr-only"> à {provider.name}</span>
          </Link>
        </>
      }
    />
  );
}
