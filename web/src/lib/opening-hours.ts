/**
 * Horaires d'ouverture d'une force étatique, au format structuré de l'API
 * (`EstablishmentSchema::validOpeningHours`) : `{ mon: [["08:00", "17:00"]], sat: [["08:00", "12:00"]] }`.
 * Un jour absent (ou sans plage) est un jour de fermeture. « Ouvert 24 h/24 » est porté à part
 * par `is_open_24h`.
 */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAYS)[number];

/** Plage horaire [ouverture, fermeture] au format « HH:MM ». */
export type TimeSlot = [string, string];
export type OpeningHours = Partial<Record<DayKey, TimeSlot[]>>;

/** Nombre maximal de plages par jour (limite de l'API). */
export const MAX_SLOTS_PER_DAY = 4;

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
};

const SCHEMA_DAYS: Record<DayKey, string> = {
  mon: 'Mo',
  tue: 'Tu',
  wed: 'We',
  thu: 'Th',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'Su',
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

/** Même contrôle que l'API (liste blanche stricte des jours, 4 plages maximum, heures HH:MM). */
export function isValidOpeningHours(value: unknown): value is OpeningHours {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > DAYS.length) return false;
  return entries.every(
    ([day, slots]) =>
      (DAYS as readonly string[]).includes(day) &&
      Array.isArray(slots) &&
      slots.length <= MAX_SLOTS_PER_DAY &&
      slots.every((s) => Array.isArray(s) && s.length === 2 && isTime(s[0]) && isTime(s[1])),
  );
}

/**
 * Valeur reçue de l'API → horaires exploitables, ou `null` si rien d'utilisable
 * (valeur absente, invalide, ou aucun jour ouvert). Jours remis dans l'ordre de la semaine.
 */
export function normalizeOpeningHours(value: unknown): OpeningHours | null {
  if (!isValidOpeningHours(value)) return null;
  const out: OpeningHours = {};
  for (const day of DAYS) {
    const slots = value[day];
    if (slots && slots.length > 0) out[day] = slots.map(([a, b]) => [a, b] as TimeSlot);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** « 08:00 » → « 8 h », « 08:30 » → « 8 h 30 ». */
export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hours = String(Number(h));
  return m === '00' ? `${hours} h` : `${hours} h ${m}`;
}

function formatSlots(slots: TimeSlot[]): string {
  return slots.map(([a, b]) => `${formatTime(a)} – ${formatTime(b)}`).join(', ');
}

function dayRange(from: DayKey, to: DayKey): string {
  if (from === to) return DAY_LABELS[from];
  const next = DAYS[DAYS.indexOf(from) + 1];
  if (next === to) return `${DAY_LABELS[from]} et ${DAY_LABELS[to].toLowerCase()}`;
  return `Du ${DAY_LABELS[from].toLowerCase()} au ${DAY_LABELS[to].toLowerCase()}`;
}

export interface OpeningHoursLine {
  days: string;
  hours: string;
}

/** Regroupe les jours consécutifs de même clé : [{ from: 'mon', to: 'fri', day: 'mon' }, …]. */
function groupDays(keyOf: (d: DayKey) => string): { from: DayKey; to: DayKey }[] {
  const groups: { from: DayKey; to: DayKey }[] = [];
  for (const day of DAYS) {
    const last = groups[groups.length - 1];
    if (last && keyOf(last.to) === keyOf(day)) last.to = day;
    else groups.push({ from: day, to: day });
  }
  return groups;
}

/**
 * Lignes lisibles, jours consécutifs identiques regroupés :
 * « Du lundi au vendredi : 8 h – 17 h », « Samedi : 8 h – 12 h », « Dimanche : fermé ».
 */
export function openingHoursLines(value: unknown): OpeningHoursLine[] {
  const hours = normalizeOpeningHours(value);
  if (!hours) return [];
  const keyOf = (d: DayKey) => {
    const slots = hours[d];
    return slots ? formatSlots(slots) : 'fermé';
  };
  return groupDays(keyOf).map(({ from, to }) => ({ days: dayRange(from, to), hours: keyOf(from) }));
}

export const OPEN_24H_LABEL = 'Ouvert 24 h/24, 7 j/7';
export const NO_HOURS_LABEL = 'Horaires non communiqués';

/** Texte unique pour tous les affichages (une ligne par groupe de jours). */
export function formatOpeningHours(value: unknown, isOpen24h = false): string {
  if (isOpen24h) return OPEN_24H_LABEL;
  const lines = openingHoursLines(value);
  if (lines.length === 0) return NO_HOURS_LABEL;
  return lines.map((l) => `${l.days} : ${l.hours}`).join('\n');
}

/** Horaires renseignés (ou ouverture permanente) ? */
export function hasOpeningHours(value: unknown, isOpen24h = false): boolean {
  return isOpen24h || normalizeOpeningHours(value) !== null;
}

/** Valeur schema.org `openingHours` (ex. `["Mo-Fr 08:00-17:00", "Sa 08:00-12:00"]`). */
export function schemaOrgOpeningHours(value: unknown, isOpen24h = false): string[] | undefined {
  if (isOpen24h) return ['Mo-Su'];
  const hours = normalizeOpeningHours(value);
  if (!hours) return undefined;
  const out: string[] = [];
  for (const { from, to } of groupDays((d) => JSON.stringify(hours[d] ?? null))) {
    const slots = hours[from];
    if (!slots) continue;
    const days = from === to ? SCHEMA_DAYS[from] : `${SCHEMA_DAYS[from]}-${SCHEMA_DAYS[to]}`;
    for (const [o, c] of slots) out.push(`${days} ${o}-${c}`);
  }
  return out;
}

/**
 * Horaires saisis → corps API : jours sans plage retirés, `null` si aucun jour ouvert ou si
 * l'établissement est ouvert 24 h/24 (les horaires détaillés n'ont alors plus de sens).
 */
export function openingHoursPayload(value: OpeningHours, isOpen24h: boolean): OpeningHours | null {
  if (isOpen24h) return null;
  const out: OpeningHours = {};
  for (const day of DAYS) {
    const slots = value[day];
    if (slots && slots.length > 0) out[day] = slots.map(([a, b]) => [a, b] as TimeSlot);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Erreurs de saisie (clés `opening_hours.<jour>.<plage>.<0|1>`), en français.
 * Contrôles en plus de l'API : fermeture après l'ouverture, plages sans chevauchement.
 */
export function openingHoursErrors(value: OpeningHours): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const day of DAYS) {
    const slots = value[day] ?? [];
    const label = DAY_LABELS[day].toLowerCase();
    if (slots.length > MAX_SLOTS_PER_DAY) {
      errors[`opening_hours.${day}`] = `${MAX_SLOTS_PER_DAY} plages au maximum pour le ${label}.`;
    }
    slots.forEach(([open, close], i) => {
      const key = `opening_hours.${day}.${i}`;
      if (!isTime(open)) errors[`${key}.0`] = `Indiquez l’heure d’ouverture du ${label}.`;
      if (!isTime(close)) errors[`${key}.1`] = `Indiquez l’heure de fermeture du ${label}.`;
      if (isTime(open) && isTime(close) && close <= open) {
        errors[`${key}.1`] =
          `Le ${label}, l’heure de fermeture doit être postérieure à l’heure d’ouverture.`;
      }
    });
    const valid = slots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => isTime(s[0]) && isTime(s[1]) && s[1] > s[0])
      .sort((a, b) => a.s[0].localeCompare(b.s[0]));
    valid.forEach((cur, k) => {
      const prev = valid[k - 1];
      if (prev && cur.s[0] < prev.s[1]) {
        errors[`opening_hours.${day}.${cur.i}.0`] =
          `Le ${label}, les plages horaires se chevauchent.`;
      }
    });
  }
  return errors;
}
