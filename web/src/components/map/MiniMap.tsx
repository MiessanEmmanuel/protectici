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
    <figure className="border-2 border-ink bg-white">
      <LeafletMap
        points={[{ slug: 'self', name, lat, lng }]}
        hrefBase=""
        label={`Carte : emplacement de ${name}`}
        mini
      />
      <figcaption className="border-t-2 border-ink p-3 text-sm text-ink-2">
        {address ? `${address}. ` : ''}Position approximative sur la carte (© OpenStreetMap).
      </figcaption>
    </figure>
  );
}
