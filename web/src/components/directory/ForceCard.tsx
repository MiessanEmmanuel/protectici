import Link from 'next/link';
import type { StateForceSummary } from '@/lib/api/types';
import { formatDistance, formatPhone, telHref } from '@/lib/format';
import { Card } from '../ui/Card';
import { Badge, Tag } from '../ui/Tag';

export function ForceCard({ force }: { force: StateForceSummary }) {
  const distance = formatDistance(force.distance_m);
  const place = [force.district?.name, force.city.name].filter(Boolean).join(', ');
  return (
    <Card as="article" className="flex h-full flex-col gap-3">
      <div>
        <Tag>{force.force_type.name}</Tag>
        <h3 className="mt-2 text-lg font-bold">
          <Link href={`/forces-etatiques/${force.slug}`} className="text-ink hover:text-primary">
            {force.name}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          {place}
          {distance ? <span> · à {distance}</span> : null}
        </p>
        {force.address ? <p className="text-sm text-muted">{force.address}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {force.is_open_24h ? (
          <Badge tone="success">Ouvert 24 h/24</Badge>
        ) : (
          <Badge>Horaires limités</Badge>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm">
        {force.emergency_phone ? (
          <a
            href={telHref(force.emergency_phone)}
            className="inline-flex min-h-tap items-center font-semibold"
          >
            Urgence : {force.emergency_phone}
          </a>
        ) : null}
        {force.phone ? (
          <a href={telHref(force.phone)} className="inline-flex min-h-tap items-center">
            {formatPhone(force.phone)}
          </a>
        ) : null}
      </div>
    </Card>
  );
}
