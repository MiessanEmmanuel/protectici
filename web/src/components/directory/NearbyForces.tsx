'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { StateForceSummary } from '@/lib/api/types';
import { buildHref } from '@/lib/search-params';
import { ButtonLink } from '../ui/Button';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';
import { ForceCard } from './ForceCard';
import { ProximityControl, type Geo } from './ProximityControl';

/** Aperçu des forces proches : la position n'est utilisée qu'après une action explicite. */
export function NearbyForces({ initial }: { initial: StateForceSummary[] }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [forces, setForces] = useState<StateForceSummary[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: Geo | null) {
    setGeo(next);
    setError(null);
    if (!next) {
      setForces(initial);
      return;
    }
    setLoading(true);
    try {
      const res = await clientApi.listStateForces({
        lat: next.lat,
        lng: next.lng,
        sort: 'distance',
        per_page: 3,
      });
      setForces(res.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ProximityControl value={geo} onChange={(g) => void onChange(g)} />
      <h3 className="text-lg font-semibold">{geo ? 'Les plus proches de vous' : 'À découvrir'}</h3>
      {loading ? <LoadingBlock label="Recherche des forces les plus proches…" /> : null}
      {error ? <ErrorState title="Recherche impossible">{error}</ErrorState> : null}
      {!loading && !error && forces.length === 0 ? (
        <EmptyState title="Aucune structure trouvée à proximité">
          Essayez une autre ville ou consultez l’annuaire complet.
        </EmptyState>
      ) : null}
      {!loading && !error && forces.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {forces.map((f) => (
            <li key={f.slug}>
              <ForceCard force={f} />
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <ButtonLink
          href={
            geo
              ? buildHref('/forces-etatiques', { lat: geo.lat, lng: geo.lng, sort: 'distance' })
              : '/forces-etatiques'
          }
          variant="secondary"
        >
          Voir toutes les forces étatiques
        </ButtonLink>
      </div>
    </div>
  );
}
