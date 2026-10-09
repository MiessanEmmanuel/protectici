'use client';

import type { Marker as LeafletMarker } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { ATTRIBUTION, DEFAULT_CENTER, markerIcon, TILE_URL } from './MapView';

export interface PickerMapProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  label: string;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function Clicks({ onPick }: { onPick: PickerMapProps['onPick'] }) {
  useMapEvents({ click: (e) => onPick(round(e.latlng.lat), round(e.latlng.lng)) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [map, lat, lng]);
  return null;
}

/** Carte de pointage : un clic ou le glissement du repère fixe les coordonnées. */
export default function PickerMap({ lat, lng, onPick, label }: PickerMapProps) {
  const has = lat !== null && lng !== null;
  return (
    <div role="region" aria-label={label}>
      <MapContainer
        center={has ? [lat, lng] : DEFAULT_CENTER}
        zoom={has ? 15 : 11}
        scrollWheelZoom={false}
        className="h-72 w-full rounded-lg"
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        <Clicks onPick={onPick} />
        {has ? (
          <>
            <Recenter lat={lat} lng={lng} />
            <Marker
              position={[lat, lng]}
              icon={markerIcon}
              draggable
              alt="Position de l’établissement"
              eventHandlers={{
                dragend: (e) => {
                  const p = (e.target as LeafletMarker).getLatLng();
                  onPick(round(p.lat), round(p.lng));
                },
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
