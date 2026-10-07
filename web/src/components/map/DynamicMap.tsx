'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/Spinner';
import type { MapViewProps } from './MapView';

/** Leaflet manipule `window` : chargement uniquement côté client. */
export const DynamicMap = dynamic<MapViewProps>(() => import('./MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-[28rem] w-full" />,
});
