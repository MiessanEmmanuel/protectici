'use client';

import { useState, type FormEvent } from 'react';
import type {
  AdminReferenceInput,
  AdminReferenceItem,
  ReferenceResource,
} from '@/lib/api/types';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';

export interface CityOption {
  id: number;
  name: string;
}

interface Props {
  resource: ReferenceResource;
  item: AdminReferenceItem | null;
  cities: CityOption[];
  parents: CityOption[];
  onSubmit: (input: AdminReferenceInput) => Promise<void>;
  onCancel: () => void;
}

type Errors = Record<string, string>;

function parseNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Formulaire de création / modification d'une valeur de référentiel (slug en lecture seule). */
export function ReferenceForm({ resource, item, cities, parents, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? 0));
  const [visible, setVisible] = useState(item?.is_visible ?? true);
  const [description, setDescription] = useState(item?.description ?? '');
  const [lat, setLat] = useState(item?.lat != null ? String(item.lat) : '');
  const [lng, setLng] = useState(item?.lng != null ? String(item.lng) : '');
  const [cityId, setCityId] = useState(item?.city_id != null ? String(item.city_id) : '');
  const [parentId, setParentId] = useState(item?.parent_id != null ? String(item.parent_id) : '');
  const [errors, setErrors] = useState<Errors>({});
  const { run, busy, error } = useAsyncAction();

  const isCity = resource === 'cities';
  const isDistrict = resource === 'districts';

  function validate(): { input: AdminReferenceInput } | { errors: Errors } {
    const e: Errors = {};
    const trimmed = name.trim();
    if (!trimmed) e.name = 'Le nom est obligatoire.';
    else if (trimmed.length > 150) e.name = 'Le nom ne peut pas dépasser 150 caractères.';
    const order = Number(sortOrder);
    if (sortOrder.trim() === '' || !Number.isInteger(order) || order < 0) {
      e.sort_order = 'L’ordre doit être un entier supérieur ou égal à 0.';
    }
    const input: AdminReferenceInput = {
      name: trimmed,
      sort_order: order,
      is_visible: visible,
      description: description.trim() || null,
    };
    if (isCity) {
      const la = parseNumber(lat);
      const lo = parseNumber(lng);
      if (la !== null && (Number.isNaN(la) || la < -90 || la > 90)) {
        e.lat = 'La latitude doit être comprise entre -90 et 90.';
      }
      if (lo !== null && (Number.isNaN(lo) || lo < -180 || lo > 180)) {
        e.lng = 'La longitude doit être comprise entre -180 et 180.';
      }
      if ((la === null) !== (lo === null) && !e.lat && !e.lng) {
        e[la === null ? 'lat' : 'lng'] = 'Renseignez la latitude et la longitude, ou aucune des deux.';
      }
      input.lat = la;
      input.lng = lo;
    }
    if (isDistrict) {
      if (!cityId) e.city_id = 'Choisissez une ville.';
      input.city_id = cityId ? Number(cityId) : null;
      input.parent_id = parentId ? Number(parentId) : null;
    }
    return Object.keys(e).length ? { errors: e } : { input };
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const result = validate();
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await run(() => onSubmit(result.input));
  }

  const apiFields = error?.fields ?? {};
  const err = (k: string) => errors[k] ?? apiFields[k];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input
        label="Nom"
        required
        maxLength={150}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={err('name')}
        disabled={busy}
      />
      {item ? (
        <Input
          label="Identifiant (slug)"
          value={item.slug}
          readOnly
          hint="Généré automatiquement, non modifiable."
        />
      ) : null}
      <Input
        label="Ordre d’affichage"
        type="number"
        min={0}
        step={1}
        required
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        error={err('sort_order')}
        disabled={busy}
      />
      {isDistrict ? (
        <>
          <Select
            label="Ville"
            required
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            error={err('city_id')}
            disabled={busy}
          >
            <option value="">Choisir une ville</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Quartier parent (facultatif)"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            error={err('parent_id')}
            disabled={busy}
          >
            <option value="">Aucun</option>
            {parents
              .filter((p) => p.id !== item?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            {item?.parent_id != null && !parents.some((p) => p.id === item.parent_id) ? (
              <option value={item.parent_id}>Quartier n° {item.parent_id}</option>
            ) : null}
          </Select>
        </>
      ) : null}
      {isCity ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Latitude"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            error={err('lat')}
            disabled={busy}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            error={err('lng')}
            disabled={busy}
          />
        </div>
      ) : null}
      <Textarea
        label="Description (facultatif)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
        error={err('description')}
        disabled={busy}
      />
      <Checkbox
        label="Visible dans les formulaires et l’annuaire"
        checked={visible}
        onChange={(e) => setVisible(e.target.checked)}
        disabled={busy}
      />
      <FormError message={error?.form} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" loading={busy}>
          {item ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
