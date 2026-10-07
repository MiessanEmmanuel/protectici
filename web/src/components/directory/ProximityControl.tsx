'use client';

import { useId, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { GeocodeResult } from '@/lib/api/types';
import { Button } from '../ui/Button';

export interface Geo {
  lat: number;
  lng: number;
  label?: string;
}

interface ProximityControlProps {
  value: Geo | null;
  onChange: (geo: Geo | null) => void;
}

/**
 * Proximité : géolocalisation navigateur (sur ACTION explicite uniquement, jamais stockée ni
 * journalisée) ou saisie d'une ville/quartier géocodée via l'API (/geocode).
 */
export function ProximityControl({ value, onChange }: ProximityControlProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [message, setMessage] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function locate() {
    if (!('geolocation' in navigator)) {
      setMessage(
        "La géolocalisation n'est pas disponible sur cet appareil. Saisissez une ville ou un quartier.",
      );
      return;
    }
    setLocating(true);
    setMessage('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMessage('');
        setResults(null);
        onChange({
          lat: round(pos.coords.latitude),
          lng: round(pos.coords.longitude),
          label: 'Ma position',
        });
      },
      (err) => {
        setLocating(false);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Position refusée. Vous pouvez saisir une ville ou un quartier à la place.'
            : "Votre position n'a pas pu être déterminée. Saisissez une ville ou un quartier.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setMessage('Saisissez au moins 3 caractères.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setMessage('');
    try {
      const found = await clientApi.geocode(q, controller.signal);
      setResults(found);
      setMessage(found.length ? '' : 'Aucun lieu trouvé. Essayez un autre nom.');
    } catch (e) {
      if (controller.signal.aborted) return;
      setResults(null);
      setMessage(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
      <legend className="px-1 font-semibold">Près de chez moi</legend>
      {value ? (
        <p className="flex flex-wrap items-center gap-2" role="status">
          <span>
            Autour de : <strong>{value.label ?? 'position choisie'}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Retirer
          </Button>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Button
          variant="secondary"
          onClick={locate}
          loading={locating}
          className="sm:shrink-0"
        >
          Utiliser ma position
        </Button>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-medium">
            ou saisir une ville / un quartier
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="search"
              value={query}
              maxLength={100}
              autoComplete="off"
              placeholder="Ex. Riviera Palmeraie"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void search();
                }
              }}
              className="min-h-tap min-w-0 flex-1 rounded-md border border-line bg-surface px-3"
            />
            <Button variant="secondary" onClick={() => void search()} loading={searching}>
              Chercher
            </Button>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {message}
      </p>
      {results && results.length > 0 ? (
        <ul
          className="divide-y divide-line rounded-md border border-line"
          aria-label="Lieux trouvés"
        >
          {results.map((r) => (
            <li key={`${r.label}-${r.lat}-${r.lng}`}>
              <button
                type="button"
                className="min-h-tap w-full px-3 text-left hover:bg-primary-soft"
                onClick={() => {
                  setResults(null);
                  setQuery('');
                  onChange({ lat: round(r.lat), lng: round(r.lng), label: r.label });
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

/** Arrondi à 3 décimales (~100 m) : suffisant pour « le plus proche », moins précis à transmettre. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
