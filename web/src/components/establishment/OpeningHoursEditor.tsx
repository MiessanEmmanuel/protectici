'use client';

import { Plus, X } from 'lucide-react';
import {
  DAY_LABELS,
  DAYS,
  MAX_SLOTS_PER_DAY,
  type DayKey,
  type OpeningHours,
  type TimeSlot,
} from '@/lib/opening-hours';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FieldError } from '../ui/Field';
import { Input } from '../ui/Input';

const DEFAULT_SLOT: TimeSlot = ['08:00', '17:00'];

interface Props {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
  isOpen24h: boolean;
  onOpen24hChange: (next: boolean) => void;
  /** Erreurs par clé : `opening_hours`, `opening_hours.mon`, `opening_hours.mon.0.1`… */
  errors: Record<string, string>;
  disabled?: boolean;
  /** Préfixe des identifiants (`f-opening_hours.mon.0.0`…). */
  idPrefix?: string;
  /** Titre du groupe (fieldset). */
  legend?: string;
}

/**
 * Saisie des horaires d'ouverture : « ouvert 24 h sur 24 », ou, pour chaque jour, fermé ou une à
 * quatre plages horaires. Produit directement le format structuré de l'API.
 */
export function OpeningHoursEditor({
  value,
  onChange,
  isOpen24h,
  onOpen24hChange,
  errors,
  disabled,
  idPrefix = 'f-opening_hours',
  legend = 'Horaires d’ouverture',
}: Props) {
  function setDay(day: DayKey, slots: TimeSlot[]) {
    const next: OpeningHours = { ...value };
    if (slots.length > 0) next[day] = slots;
    else delete next[day];
    onChange(next);
  }

  function openDay(day: DayKey) {
    // Reprend les horaires du jour ouvert précédent : saisie plus rapide d'une semaine type.
    const before = DAYS.slice(0, DAYS.indexOf(day))
      .reverse()
      .find((d) => (value[d]?.length ?? 0) > 0);
    const model = before ? value[before] : undefined;
    setDay(day, model ? model.map(([a, b]) => [a, b] as TimeSlot) : [[...DEFAULT_SLOT]]);
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="px-1 text-lg font-semibold">{legend}</legend>
      <Checkbox
        id={`${idPrefix}-24h`}
        label="Ouvert 24 h sur 24, 7 jours sur 7"
        checked={isOpen24h}
        onChange={(e) => onOpen24hChange(e.target.checked)}
      />
      <FieldError id={`${idPrefix}-error`} message={errors.opening_hours} />
      {isOpen24h ? (
        <p className="text-sm text-muted">
          Les horaires détaillés ne sont pas nécessaires pour un établissement ouvert en permanence.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Cochez les jours d’ouverture puis indiquez les plages horaires (jusqu’à{' '}
            {MAX_SLOTS_PER_DAY} par jour, par exemple 8 h – 12 h et 14 h – 17 h). Laissez tous les
            jours décochés si les horaires ne sont pas connus.
          </p>
          <ul className="flex flex-col gap-3" aria-label="Horaires par jour">
            {DAYS.map((day) => {
              const slots = value[day] ?? [];
              const label = DAY_LABELS[day];
              const lower = label.toLowerCase();
              const open = slots.length > 0;
              return (
                <li key={day} className="border-2 border-ink p-3">
                  <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="sr-only">{label}</legend>
                    <div className="flex flex-wrap items-center justify-between gap-x-4">
                      <Checkbox
                        id={`${idPrefix}.${day}`}
                        label={
                          <>
                            <span className="font-bold">{label}</span>
                            <span className="sr-only">, jour ouvert</span>
                          </>
                        }
                        checked={open}
                        onChange={(e) => (e.target.checked ? openDay(day) : setDay(day, []))}
                        error={errors[`opening_hours.${day}`]}
                      />
                      {open ? null : <span className="text-muted">Fermé</span>}
                    </div>
                    {open ? (
                      <>
                        <ol className="flex flex-col gap-3" aria-label={`Plages du ${lower}`}>
                          {slots.map(([start, end], i) => {
                            const key = `opening_hours.${day}.${i}`;
                            const which = slots.length > 1 ? `, plage ${i + 1}` : '';
                            const update = (pos: 0 | 1, v: string) =>
                              setDay(
                                day,
                                slots.map((s, k) =>
                                  k === i ? ((pos === 0 ? [v, s[1]] : [s[0], v]) as TimeSlot) : s,
                                ),
                              );
                            return (
                              <li
                                key={i}
                                className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
                              >
                                <Input
                                  id={`${idPrefix}.${day}.${i}.0`}
                                  type="time"
                                  label={
                                    <>
                                      Ouverture
                                      <span className="sr-only">
                                        {' '}
                                        du {lower}
                                        {which}
                                      </span>
                                    </>
                                  }
                                  value={start}
                                  onChange={(e) => update(0, e.target.value)}
                                  error={errors[`${key}.0`]}
                                />
                                <Input
                                  id={`${idPrefix}.${day}.${i}.1`}
                                  type="time"
                                  label={
                                    <>
                                      Fermeture
                                      <span className="sr-only">
                                        {' '}
                                        du {lower}
                                        {which}
                                      </span>
                                    </>
                                  }
                                  value={end}
                                  onChange={(e) => update(1, e.target.value)}
                                  error={errors[`${key}.1`]}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="col-span-2 justify-self-start sm:col-span-1 sm:mt-8"
                                  aria-label={`Retirer la plage ${i + 1} du ${lower}`}
                                  onClick={() => {
                                    setDay(
                                      day,
                                      slots.filter((_, k) => k !== i),
                                    );
                                    document.getElementById(`${idPrefix}.${day}`)?.focus();
                                  }}
                                >
                                  <X aria-hidden="true" />
                                  Retirer
                                </Button>
                              </li>
                            );
                          })}
                        </ol>
                        {slots.length < MAX_SLOTS_PER_DAY ? (
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Ajouter une plage horaire au ${lower}`}
                              onClick={() => setDay(day, [...slots, ['', '']])}
                            >
                              <Plus aria-hidden="true" />
                              Ajouter une plage
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
