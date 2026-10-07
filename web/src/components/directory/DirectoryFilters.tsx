'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { ReferenceData } from '@/lib/api/types';
import { buildHref } from '@/lib/search-params';
import { Button, ButtonLink } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ProximityControl, type Geo } from './ProximityControl';

interface BaseProps {
  reference: ReferenceData;
  basePath: string;
  view: 'list' | 'map';
  initial: {
    q?: string;
    city?: string;
    district?: string;
    sort?: string;
    lat?: number;
    lng?: number;
    first?: string; // service (prestataires) ou type (forces)
    second?: string; // type d'entreprise (prestataires) ou démarche (forces)
  };
}

type Props = BaseProps & { kind: 'providers' | 'forces' };

/**
 * Formulaire de filtres. L'URL est la source de vérité : la soumission navigue vers l'URL
 * filtrée (rendu serveur). Sans JavaScript, le formulaire GET natif fonctionne aussi.
 */
export function DirectoryFilters({ kind, reference, basePath, view, initial }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [city, setCity] = useState(initial.city ?? '');
  const [district, setDistrict] = useState(initial.district ?? '');
  const [sort, setSort] = useState(initial.sort ?? '');
  const [geo, setGeo] = useState<Geo | null>(
    initial.lat !== undefined && initial.lng !== undefined
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );

  const districts = useMemo(() => {
    const selected = reference.cities.find((c) => c.slug === city);
    return selected?.districts ?? [];
  }, [reference.cities, city]);

  const firstName = kind === 'providers' ? 'service' : 'type';
  const secondName = kind === 'providers' ? 'company_type' : 'procedure';

  /** Navigue vers l'URL filtrée (valeurs du formulaire + éventuelle position/tri imposés). */
  function navigate(form: HTMLFormElement, nextGeo: Geo | null, sortOverride?: string) {
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    router.push(
      buildHref(basePath, {
        q: get('q'),
        city: get('city'),
        district: get('district'),
        [firstName]: get(firstName),
        [secondName]: get(secondName),
        sort: sortOverride ?? get('sort'),
        lat: nextGeo?.lat,
        lng: nextGeo?.lng,
        view: view === 'map' ? 'map' : undefined,
      }),
    );
  }

  function onGeoChange(next: Geo | null) {
    setGeo(next);
    const nextSort = next ? 'distance' : sort === 'distance' ? '' : sort;
    setSort(nextSort);
    if (formRef.current) navigate(formRef.current, next, nextSort);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate(e.currentTarget, geo);
  }

  const firstOptions = kind === 'providers' ? reference.service_types : reference.state_force_types;
  const secondOptions = kind === 'providers' ? reference.company_types : reference.procedure_types;

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      onSubmit={onSubmit}
      role="search"
      aria-label={
        kind === 'providers' ? 'Filtrer les prestataires' : 'Filtrer les forces étatiques'
      }
      className="grid gap-4 rounded-lg border border-line bg-surface-alt p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Input
        label={kind === 'providers' ? 'Nom du prestataire' : 'Nom de la structure'}
        name="q"
        type="search"
        defaultValue={initial.q ?? ''}
        maxLength={100}
        placeholder={kind === 'providers' ? 'Ex. gardiennage, Sentinelle…' : 'Ex. commissariat'}
      />
      <Select
        label="Ville"
        name="city"
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          setDistrict('');
        }}
      >
        <option value="">Toutes les villes</option>
        {reference.cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label="Quartier / commune"
        name="district"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        disabled={!city}
      >
        <option value="">{city ? 'Tous les quartiers' : 'Choisissez d’abord une ville'}</option>
        {districts.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </Select>
      <Select
        label={kind === 'providers' ? 'Type de service' : 'Type de force'}
        name={firstName}
        defaultValue={initial.first ?? ''}
      >
        <option value="">{kind === 'providers' ? 'Tous les services' : 'Toutes les forces'}</option>
        {firstOptions.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </Select>
      <Select
        label={kind === 'providers' ? 'Type d’entreprise' : 'Démarche'}
        name={secondName}
        defaultValue={initial.second ?? ''}
      >
        <option value="">{kind === 'providers' ? 'Tous les types' : 'Toutes les démarches'}</option>
        {secondOptions.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </Select>
      <Select label="Trier par" name="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
        {kind === 'providers' ? (
          <>
            <option value="">Popularité</option>
            <option value="-rating">Meilleures notes</option>
            <option value="name">Nom (A–Z)</option>
          </>
        ) : (
          <option value="">Nom (A–Z)</option>
        )}
        {geo ? <option value="distance">Distance (du plus proche)</option> : null}
      </Select>

      <div className="sm:col-span-2 lg:col-span-3">
        <ProximityControl value={geo} onChange={onGeoChange} />
      </div>

      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit">Rechercher</Button>
        <ButtonLink href={view === 'map' ? `${basePath}?view=map` : basePath} variant="ghost">
          Réinitialiser
        </ButtonLink>
      </div>
      {geo ? (
        <>
          <input type="hidden" name="lat" value={geo.lat} />
          <input type="hidden" name="lng" value={geo.lng} />
        </>
      ) : null}
    </form>
  );
}
