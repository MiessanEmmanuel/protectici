'use client';

import L from 'leaflet';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { clusterPoints, type Point } from '@/lib/cluster';

const DEFAULT_CENTER: [number, number] = [5.3364, -4.0267]; // Abidjan
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

/** Icônes servies localement (/public/map) : aucun appel CDN. */
const markerIcon = L.icon({
  iconUrl: '/map/marker-icon.png',
  iconRetinaUrl: '/map/marker-icon-2x.png',
  shadowUrl: '/map/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function clusterIcon(count: number): L.DivIcon {
  // Classe CSS uniquement (pas d'attribut style : compatible CSP stricte). `count` est un nombre.
  return L.divIcon({
    html: `<span>${Number(count)}</span>`,
    className: 'pi-cluster',
    iconSize: [40, 40],
  });
}

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 14);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [32, 32], maxZoom: 15 },
    );
  }, [map, points]);
  return null;
}

function Markers({ points, hrefBase }: { points: Point[]; hrefBase: string }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const clusters = useMemo(() => clusterPoints(points, zoom), [points, zoom]);

  return (
    <>
      {clusters.map((c) =>
        c.count === 1 ? (
          <Marker
            key={c.members[0]!.slug}
            position={[c.lat, c.lng]}
            icon={markerIcon}
            title={c.members[0]!.name}
            alt={c.members[0]!.name}
          >
            <Popup>
              <strong>{c.members[0]!.name}</strong>
              <br />
              <Link href={`${hrefBase}/${c.members[0]!.slug}`}>Voir la fiche</Link>
            </Popup>
          </Marker>
        ) : (
          <Marker
            key={`cluster-${c.key}`}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.count)}
            title={`${c.count} résultats regroupés`}
            alt={`${c.count} résultats regroupés`}
            eventHandlers={{
              click: () =>
                map.fitBounds(
                  c.members.map((m) => [m.lat, m.lng] as [number, number]),
                  { padding: [40, 40], maxZoom: 17 },
                ),
            }}
          />
        ),
      )}
    </>
  );
}

export interface MapViewProps {
  points: Point[];
  hrefBase: string;
  label: string;
  /** Mode fiche : un seul point, pas de molette, pas de regroupement. */
  mini?: boolean;
}

export default function MapView({ points, hrefBase, label, mini = false }: MapViewProps) {
  const first = points[0];
  return (
    <div role="region" aria-label={label}>
      <MapContainer
        center={first ? [first.lat, first.lng] : DEFAULT_CENTER}
        zoom={mini ? 15 : 11}
        scrollWheelZoom={!mini}
        className={mini ? 'h-56 w-full rounded-lg' : 'h-[28rem] w-full rounded-lg'}
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        {mini ? (
          first ? (
            <Marker
              position={[first.lat, first.lng]}
              icon={markerIcon}
              title={first.name}
              alt={first.name}
            />
          ) : null
        ) : (
          <>
            <FitBounds points={points} />
            <Markers points={points} hrefBase={hrefBase} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
