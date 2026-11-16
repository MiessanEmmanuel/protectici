'use client';

import L from 'leaflet';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { clusterPoints, type Point } from '@/lib/cluster';
import { tileAttribution, tileUrl } from '@/lib/env';

export const DEFAULT_CENTER: [number, number] = [5.3364, -4.0267]; // Abidjan
/** Tuiles configurables (NEXT_PUBLIC_TILE_URL, défaut OSM) ; attribution OSM toujours affichée. */
export const TILE_URL = tileUrl();
export const ATTRIBUTION = tileAttribution();

/** Icônes servies localement (/public/map) : aucun appel CDN. */
export const markerIcon = L.icon({
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

/** Point affiché : un établissement, ou l'une de ses agences quand `branch_label` est renseigné. */
export interface MapPoint extends Point {
  branch_label?: string | null;
}

/** Libellé d'un marqueur : « Nom » ou « Nom — Agence de X ». */
export function pointLabel(p: MapPoint): string {
  return p.branch_label ? `${p.name} — ${p.branch_label}` : p.name;
}

/** Clé unique : plusieurs points (siège, agences) peuvent partager le même slug. */
export function pointKey(p: MapPoint): string {
  return `${p.slug}|${p.branch_label ?? ''}@${p.lat},${p.lng}`;
}

function FitBounds({ points, singleZoom = 14 }: { points: Point[]; singleZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], singleZoom);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [32, 32], maxZoom: 15 },
    );
  }, [map, points, singleZoom]);
  return null;
}

function Markers({ points, hrefBase }: { points: MapPoint[]; hrefBase: string }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const clusters = useMemo(() => clusterPoints(points, zoom), [points, zoom]);

  return (
    <>
      {clusters.map((c) => {
        if (c.count > 1)
          return (
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
          );
        // Les membres sont les points passés en entrée : ils portent `branch_label`.
        const p = c.members[0] as MapPoint;
        return (
          <Marker
            key={pointKey(p)}
            position={[c.lat, c.lng]}
            icon={markerIcon}
            title={pointLabel(p)}
            alt={pointLabel(p)}
          >
            <Popup>
              <strong>{p.name}</strong>
              {p.branch_label ? (
                <>
                  <br />
                  {p.branch_label}
                </>
              ) : null}
              <br />
              <Link href={`${hrefBase}/${p.slug}`}>
                Voir la fiche<span className="sr-only"> de {p.name}</span>
              </Link>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export interface MapViewProps {
  points: MapPoint[];
  hrefBase: string;
  label: string;
  /** Mode fiche : quelques points (siège, agences), pas de molette, pas de regroupement. */
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
        className={mini ? 'h-56 w-full' : 'h-[28rem] w-full'}
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        {mini ? (
          <>
            {points.length > 1 ? <FitBounds points={points} singleZoom={15} /> : null}
            {points.map((p) => (
              <Marker
                key={pointKey(p)}
                position={[p.lat, p.lng]}
                icon={markerIcon}
                title={pointLabel(p)}
                alt={pointLabel(p)}
              >
                {points.length > 1 ? <Popup>{pointLabel(p)}</Popup> : null}
              </Marker>
            ))}
          </>
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
