'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { pluralize } from '@/lib/format';
import { Skeleton } from '../ui/Spinner';
import type { MapPoint, MapViewProps } from './MapView';

const LeafletMap = dynamic<MapViewProps>(() => import('./MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

/** Agence à placer sur la carte (les agences sans coordonnées sont ignorées). */
export interface MiniMapBranch {
  label: string;
  lat: number | null;
  lng: number | null;
}

/** Points de la petite carte : le siège (s'il est géolocalisé) puis les agences géolocalisées. */
export function miniMapPoints(
  name: string,
  lat: number | null,
  lng: number | null,
  branches: MiniMapBranch[] = [],
): MapPoint[] {
  const points: MapPoint[] = [];
  if (lat !== null && lng !== null) points.push({ slug: 'self', name, lat, lng });
  for (const b of branches) {
    if (b.lat !== null && b.lng !== null)
      points.push({ slug: 'self', name, branch_label: b.label, lat: b.lat, lng: b.lng });
  }
  return points;
}

/**
 * Petite carte d'une fiche : un point (force étatique, établissement) ou plusieurs
 * (siège + agences d'un prestataire), avec cadrage automatique sur l'ensemble.
 */
export function MiniMap({
  name,
  lat,
  lng,
  address,
  branches,
}: {
  name: string;
  lat: number | null;
  lng: number | null;
  address?: string | null;
  branches?: MiniMapBranch[];
}) {
  // Référence stable (clé sérialisée) : la carte ne se recadre que si les points changent.
  const key = JSON.stringify(miniMapPoints(name, lat, lng, branches));
  const points = useMemo(() => JSON.parse(key) as MapPoint[], [key]);
  if (points.length === 0) return null;

  const hasHeadOffice = lat !== null && lng !== null;
  const branchCount = points.length - (hasHeadOffice ? 1 : 0);
  const agencies = pluralize(branchCount, 'agence', 'agences');

  let caption: string;
  let label: string;
  if (branchCount === 0) {
    caption = `${address ? `${address}. ` : ''}Position approximative sur la carte (© OpenStreetMap).`;
    label = `Carte : emplacement de ${name}`;
  } else if (hasHeadOffice) {
    caption = `Siège et ${agencies} sur la carte. Positions approximatives (© OpenStreetMap).`;
    label = `Carte : emplacements du siège et des agences de ${name}`;
  } else {
    caption = `${agencies} sur la carte. Positions approximatives (© OpenStreetMap).`;
    label = `Carte : emplacements des agences de ${name}`;
  }

  return (
    <figure className="border-2 border-ink bg-white">
      <LeafletMap
        points={points}
        hrefBase=""
        label={label}
        mini
      />
      <figcaption className="border-t-2 border-ink p-3 text-sm text-ink-2">{caption}</figcaption>
    </figure>
  );
}
