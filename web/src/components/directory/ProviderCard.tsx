import Link from 'next/link';
import type { ProviderSummary } from '@/lib/api/types';
import { formatDistance, formatFcfa, formatPhone, telHref } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { RatingStars } from '../ui/RatingStars';
import { Badge, Tag } from '../ui/Tag';

export function ProviderCard({ provider }: { provider: ProviderSummary }) {
  const distance = formatDistance(provider.distance_m);
  const place = [provider.district?.name, provider.city.name].filter(Boolean).join(', ');
  return (
    <Card as="article" className="flex h-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={provider.name} src={provider.logo_url} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold">
            <Link href={`/annuaire/${provider.slug}`} className="text-ink hover:text-primary">
              {provider.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {place}
            {distance ? <span> · à {distance}</span> : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RatingStars value={provider.rating_avg} count={provider.rating_count} />
        {provider.is_verified ? <Badge tone="success">✓ Vérifié</Badge> : null}
        {provider.is_featured ? <Badge tone="accent">À la une</Badge> : null}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Services proposés">
        {provider.services.slice(0, 3).map((s) => (
          <li key={s.slug}>
            <Tag>{s.name}</Tag>
          </li>
        ))}
        {provider.services.length > 3 ? (
          <li>
            <Tag className="bg-surface-alt text-muted">+{provider.services.length - 3}</Tag>
          </li>
        ) : null}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
        <span className="text-muted">
          {provider.price_from
            ? `À partir de ${formatFcfa(provider.price_from)}`
            : 'Tarif sur devis'}
        </span>
        <a
          href={telHref(provider.phone)}
          className="inline-flex min-h-tap items-center font-semibold"
        >
          <span className="sr-only">Appeler {provider.name} : </span>
          {formatPhone(provider.phone)}
        </a>
      </div>
    </Card>
  );
}
