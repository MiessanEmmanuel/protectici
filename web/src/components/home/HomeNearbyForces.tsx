'use client';

import Link from 'next/link';
import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { StateForceSummary } from '@/lib/api/types';
import { formatDistance } from '@/lib/format';
import { geoErrorMessage, GeoError, getBrowserPosition } from '@/lib/geolocation';
import { buildHref } from '@/lib/search-params';
import { ButtonLink } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * Colonne « Forces de l'État les plus proches » (aplat bleu). Liste initiale rendue côté serveur ;
 * « Utiliser ma position » (action explicite) la remplace par les structures triées par distance.
 */
export function HomeNearbyForces({ initial }: { initial: StateForceSummary[] }) {
  const [forces, setForces] = useState(initial);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function locate() {
    setBusy(true);
    setMessage('Recherche de votre position…');
    try {
      const pos = await getBrowserPosition();
      const res = await clientApi.listStateForces({ ...pos, sort: 'distance', per_page: 4 });
      setGeo(pos);
      setForces(res.data);
      setMessage(
        res.data.length
          ? 'Position utilisée : structures triées par distance.'
          : 'Aucune structure trouvée à proximité.',
      );
    } catch (e) {
      setMessage(e instanceof GeoError ? geoErrorMessage(e) : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-labelledby="titre-forces" className="bg-c1 p-[30px] text-on-c1">
      <Eyebrow>Autour de vous</Eyebrow>
      <h2 id="titre-forces" className="mt-2.5 mb-3.5 text-[1.7rem] heading-block">
        Forces de l’État les plus proches
      </h2>
      <button
        type="button"
        onClick={() => void locate()}
        disabled={busy}
        className="mb-3.5 inline-flex min-h-tap items-center gap-2 border-2 border-current px-3.5 text-[0.85rem] font-extrabold hover:bg-on-c1 hover:text-c1 disabled:opacity-70 [&_svg]:size-[1.15em]"
      >
        <LocateFixed aria-hidden="true" />
        {busy ? 'Localisation…' : geo ? 'Actualiser ma position' : 'Utiliser ma position'}
      </button>
      <p role="status" className="min-h-0 text-sm font-semibold empty:hidden">
        {message}
      </p>
      {forces.length > 0 ? (
        <ul className="mt-2">
          {forces.map((f) => {
            const km = formatDistance(f.distance_m);
            return (
              <li key={f.slug}>
                <Link
                  href={`/forces-etatiques/${f.slug}`}
                  className="flex min-h-tap justify-between gap-3 border-t-2 border-current py-3 font-bold text-inherit no-underline hover:underline"
                >
                  <span>{f.name}</span>
                  <span className="font-black whitespace-nowrap">{km ?? f.city.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t-2 border-current py-3">
          Aucune structure à afficher pour le moment.
        </p>
      )}
      <ButtonLink
        href={
          geo
            ? buildHref('/forces-etatiques', {
                lat: geo.lat,
                lng: geo.lng,
                sort: 'distance',
                view: 'map',
              })
            : buildHref('/forces-etatiques', { view: 'map' })
        }
        variant="light"
        size="lg"
        className="mt-5"
      >
        Voir la carte
      </ButtonLink>
    </aside>
  );
}
