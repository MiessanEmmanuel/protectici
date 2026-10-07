'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/Spinner';
import type { MapViewProps } from './MapView';

const LeafletMap = dynamic<MapViewProps>(() => import('./MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

export function MiniMap({
  name,
  lat,
  lng,
  address,
}: {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}) {
  return (
    <figure>
      <LeafletMap
        points={[{ slug: 'self', name, lat, lng }]}
        hrefBase=""
        label={`Carte : emplacement de ${name}`}
        mini
      />
      <figcaption className="mt-2 text-sm text-muted">
        {address ? `${address}. ` : ''}Position approximative sur la carte (© OpenStreetMap).
      </figcaption>
    </figure>
  );
}
