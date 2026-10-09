'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { GeocodeResult, ReferenceData } from '@/lib/api/types';
import { parseCoordinate } from '@/lib/establishment-schemas';
import { MapPicker } from '../map/MapPicker';
import { Button } from '../ui/Button';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

export interface LocationValues {
  city_id: string;
  district_id: string;
  address: string;
  geo_description: string;
  plus_code: string;
  lat: string;
  lng: string;
}

interface Props {
  values: LocationValues;
  onChange: (patch: Partial<LocationValues>) => void;
  errors: Record<string, string>;
  reference: ReferenceData;
  disabled?: boolean;
}

/**
 * Localisation d'un établissement : ville, quartier, adresse, et position sur la carte.
 * Le géocodage (/geocode) n'est lancé que sur action explicite (bouton). Le pointage sur la carte
 * a une alternative clavier : saisie directe de la latitude et de la longitude.
 */
export function LocationFields({ values, onChange, errors, reference, disabled }: Props) {
  const city = reference.cities.find((c) => String(c.id) === values.city_id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const lat = parseCoordinate(values.lat, 90);
  const lng = parseCoordinate(values.lng, 180);

  async function search() {
    const q = query.trim();
    if (searching) return;
    if (q.length < 3) {
      setGeoError('Saisissez au moins 3 caractères pour lancer la recherche.');
      return;
    }
    setSearching(true);
    setGeoError(null);
    try {
      const found = await clientApi.geocode(q);
      setResults(found);
      if (found.length === 0) setGeoError('Aucun résultat. Pointez la position directement sur la carte.');
    } catch (e) {
      setResults(null);
      setGeoError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  function pick(la: number, ln: number) {
    onChange({ lat: String(la), lng: String(ln) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Ville"
          required
          value={values.city_id}
          onChange={(e) => onChange({ city_id: e.target.value, district_id: '' })}
          error={errors.city_id}
          disabled={disabled}
        >
          <option value="">Choisir une ville…</option>
          {reference.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          label="Quartier"
          value={values.district_id}
          onChange={(e) => onChange({ district_id: e.target.value })}
          error={errors.district_id}
          disabled={disabled || !city}
          hint={city ? undefined : 'Choisissez d’abord une ville.'}
        >
          <option value="">Non précisé</option>
          {city?.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Adresse"
        value={values.address}
        onChange={(e) => onChange({ address: e.target.value })}
        error={errors.address}
        maxLength={255}
        autoComplete="street-address"
        disabled={disabled}
      />
      <Textarea
        label="Repères géographiques"
        hint="Aidez les visiteurs à vous trouver : rue, immeuble, point de repère connu."
        value={values.geo_description}
        onChange={(e) => onChange({ geo_description: e.target.value })}
        error={errors.geo_description}
        rows={3}
        maxLength={500}
        disabled={disabled}
      />
      <Input
        label="Plus Code"
        hint="Facultatif, par exemple 6CQ5+2F Abidjan."
        value={values.plus_code}
        onChange={(e) => onChange({ plus_code: e.target.value })}
        error={errors.plus_code}
        maxLength={32}
        disabled={disabled}
      />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4" disabled={disabled}>
        <legend className="px-1 font-semibold">Position sur la carte</legend>
        <p className="text-sm text-muted">
          Recherchez une adresse puis choisissez un résultat, cliquez sur la carte, ou saisissez
          directement la latitude et la longitude.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            label="Rechercher une adresse"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            wrapperClassName="flex-1"
            autoComplete="off"
          />
          <Button variant="secondary" loading={searching} onClick={() => void search()}>
            Rechercher
          </Button>
        </div>
        <FormError message={geoError} />
        {results && results.length > 0 ? (
          <ul aria-label="Résultats de la recherche d’adresse" className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng},${r.label}`}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start py-2 text-left"
                  onClick={() => {
                    pick(r.lat, r.lng);
                    setResults(null);
                  }}
                >
                  {r.label}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <MapPicker
          lat={lat}
          lng={lng}
          onPick={pick}
          label="Carte de pointage : cliquez pour placer l’établissement"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Latitude"
            inputMode="decimal"
            value={values.lat}
            onChange={(e) => onChange({ lat: e.target.value })}
            error={errors.lat}
            hint="Entre -90 et 90, par exemple 5,3364."
          />
          <Input
            label="Longitude"
            inputMode="decimal"
            value={values.lng}
            onChange={(e) => onChange({ lng: e.target.value })}
            error={errors.lng}
            hint="Entre -180 et 180, par exemple -4,0267."
          />
        </div>
        <p className="text-xs text-muted">© OpenStreetMap contributors</p>
      </fieldset>
    </div>
  );
}
