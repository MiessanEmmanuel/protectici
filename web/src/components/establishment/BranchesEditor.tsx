'use client';

import type { ReferenceData } from '@/lib/api/types';
import { emptyBranch, MAX_BRANCHES, type BranchDraft } from '@/lib/establishment-schemas';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { PositionFields } from './LocationFields';

interface Props {
  value: BranchDraft[];
  onChange: (next: BranchDraft[]) => void;
  /** Erreurs par champ : `branches`, `branches.0.label`, `branches.0.city_id`… */
  errors: Record<string, string>;
  reference: ReferenceData;
  disabled?: boolean;
  /** Préfixe des identifiants (résumé d'erreurs : `f-branches.0.label`). */
  idPrefix?: string;
}

/**
 * Liste éditable des agences d'un prestataire (l'adresse de la fiche reste le siège).
 * Chaque agence est un groupe de champs (fieldset/legend) ; la carte de pointage est repliée par
 * défaut pour ne pas charger une carte par agence.
 */
export function BranchesEditor({
  value,
  onChange,
  errors,
  reference,
  disabled,
  idPrefix = 'f-branches',
}: Props) {
  const full = value.length >= MAX_BRANCHES;

  function update(i: number, patch: Partial<BranchDraft>) {
    onChange(value.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  }

  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    // Le focus suit l'agence déplacée.
    requestAnimationFrame(() =>
      document.getElementById(`${idPrefix}.${j}.${delta < 0 ? 'up' : 'down'}`)?.focus(),
    );
  }

  function add() {
    const i = value.length;
    onChange([...value, emptyBranch()]);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}.${i}.label`)?.focus());
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.branches ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.branches}
        </p>
      ) : null}
      {value.length === 0 ? (
        <p className="text-muted">Aucune agence renseignée pour le moment.</p>
      ) : null}
      <ul className="flex flex-col gap-4" aria-label="Agences">
        {value.map((b, i) => {
          const city = reference.cities.find((c) => String(c.id) === b.city_id);
          const err = (field: string) => errors[`branches.${i}.${field}`];
          const name = b.label.trim() || `Agence ${i + 1}`;
          return (
            <li key={b.uid} className="border-2 border-ink p-4">
              <fieldset className="flex flex-col gap-3" disabled={disabled}>
                <legend className="px-1 font-semibold">
                  Agence {i + 1}
                  {b.label.trim() ? ` : ${b.label.trim()}` : ''}
                </legend>
                <Input
                  id={`${idPrefix}.${i}.label`}
                  label="Nom de l’agence"
                  required
                  placeholder="Agence de Yopougon"
                  value={b.label}
                  maxLength={150}
                  onChange={(ev) => update(i, { label: ev.target.value })}
                  error={err('label')}
                  autoComplete="off"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    id={`${idPrefix}.${i}.city_id`}
                    label="Ville"
                    required
                    value={b.city_id}
                    onChange={(ev) => update(i, { city_id: ev.target.value, district_id: '' })}
                    error={err('city_id')}
                  >
                    <option value="">Choisir une ville…</option>
                    {reference.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    id={`${idPrefix}.${i}.district_id`}
                    label="Quartier"
                    value={b.district_id}
                    onChange={(ev) => update(i, { district_id: ev.target.value })}
                    error={err('district_id')}
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
                  id={`${idPrefix}.${i}.address`}
                  label="Adresse"
                  value={b.address}
                  maxLength={255}
                  onChange={(ev) => update(i, { address: ev.target.value })}
                  error={err('address')}
                  autoComplete="off"
                />
                <Textarea
                  id={`${idPrefix}.${i}.geo_description`}
                  label="Repères géographiques"
                  hint="Rue, immeuble, point de repère connu."
                  rows={3}
                  maxLength={2000}
                  value={b.geo_description}
                  onChange={(ev) => update(i, { geo_description: ev.target.value })}
                  error={err('geo_description')}
                />
                <Input
                  id={`${idPrefix}.${i}.phone`}
                  label="Téléphone de l’agence"
                  type="tel"
                  hint="Facultatif, par exemple 07 09 44 51 11."
                  value={b.phone}
                  onChange={(ev) => update(i, { phone: ev.target.value })}
                  error={err('phone')}
                  autoComplete="off"
                />
                <PositionFields
                  lat={b.lat}
                  lng={b.lng}
                  onChange={(patch) => update(i, patch)}
                  errors={{ lat: err('lat'), lng: err('lng') }}
                  disabled={disabled}
                  latId={`${idPrefix}.${i}.lat`}
                  lngId={`${idPrefix}.${i}.lng`}
                  legend="Position de l’agence sur la carte"
                  mapLabel={`Carte de pointage : cliquez pour placer ${name}`}
                  collapsible
                />
                <div className="flex flex-wrap gap-2">
                  {value.length > 1 ? (
                    <>
                      <Button
                        id={`${idPrefix}.${i}.up`}
                        variant="ghost"
                        size="sm"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={`Monter ${name} dans la liste`}
                      >
                        Monter
                      </Button>
                      <Button
                        id={`${idPrefix}.${i}.down`}
                        variant="ghost"
                        size="sm"
                        disabled={i === value.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={`Descendre ${name} dans la liste`}
                      >
                        Descendre
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onChange(value.filter((_, k) => k !== i));
                      document.getElementById(`${idPrefix}-add`)?.focus();
                    }}
                    aria-label={`Retirer ${name}`}
                  >
                    Retirer cette agence
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <div>
        <Button
          id={`${idPrefix}-add`}
          variant="secondary"
          disabled={disabled || full}
          aria-describedby={full ? `${idPrefix}-limit` : undefined}
          onClick={add}
        >
          Ajouter une agence
        </Button>
        {full ? (
          <p id={`${idPrefix}-limit`} className="mt-1 text-sm text-muted">
            Vous avez atteint la limite de {MAX_BRANCHES} agences.
          </p>
        ) : null}
      </div>
    </div>
  );
}
