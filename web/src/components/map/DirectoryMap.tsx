'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { MapMarker, MarkerQuery } from '@/lib/api/types';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Spinner';
import { DynamicMap } from './DynamicMap';

interface DirectoryMapProps {
  query: MarkerQuery;
  hrefBase: string;
  label: string;
}

/** Carte des résultats : les marqueurs viennent de /map/markers avec les mêmes filtres que la liste. */
export function DirectoryMap({ query, hrefBase, label }: DirectoryMapProps) {
  const key = JSON.stringify(query);
  const [result, setResult] = useState<{
    key: string;
    markers: MapMarker[] | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    clientApi
      .getMapMarkers(JSON.parse(key) as MarkerQuery)
      .then((markers) => active && setResult({ key, markers, error: null }))
      .catch((e) => active && setResult({ key, markers: null, error: errorMessage(e) }));
    return () => {
      active = false;
    };
  }, [key]);

  const current = result && result.key === key ? result : null;
  const markers = current?.markers ?? null;
  const error = current?.error ?? null;

  if (error)
    return (
      <ErrorState title="La carte n’a pas pu être chargée">
        {error} La liste des résultats ci-dessous reste disponible.
      </ErrorState>
    );
  if (!markers) return <Skeleton className="h-[28rem] w-full" />;
  if (markers.length === 0)
    return (
      <EmptyState title="Aucun résultat à afficher sur la carte">
        Modifiez vos filtres pour élargir la recherche.
      </EmptyState>
    );

  return (
    <figure>
      <DynamicMap points={markers} hrefBase={hrefBase} label={label} />
      <figcaption className="mt-2 text-sm text-muted">
        {markers.length} résultat{markers.length > 1 ? 's' : ''} sur la carte. Les mêmes résultats
        sont listés ci-dessous.
      </figcaption>
    </figure>
  );
}
