'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/Spinner';
import type { PickerMapProps } from './PickerMap';

/** Leaflet manipule `window` : chargement uniquement côté client. */
export const MapPicker = dynamic<PickerMapProps>(() => import('./PickerMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});
