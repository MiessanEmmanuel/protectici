'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

/* ------------------------------------------------------------------ */
/* Dates (calendrier civil, sans fuseau : arithmétique en UTC)          */
/* ------------------------------------------------------------------ */

interface Ymd {
  y: number;
  m: number; // 1..12
  d: number;
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const toIso = ({ y, m, d }: Ymd) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const toFr = ({ y, m, d }: Ymd) => `${pad(d)}/${pad(m)}/${pad(y, 4)}`;

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function valid(y: number, m: number, d: number): Ymd | null {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function parseIso(v: string | undefined | null): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return r ? valid(Number(r[1]), Number(r[2]), Number(r[3])) : null;
}

/** Saisie libre : JJ/MM/AAAA (séparateurs / . - ou espace, jour et mois sur 1 ou 2 chiffres), JJMMAAAA ou ISO. */
export function parseInput(text: string): Ymd | null {
  const t = text.trim();
  const iso = parseIso(t);
  if (iso) return iso;
  const fr = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  return fr ? valid(Number(fr[3]), Number(fr[2]), Number(fr[1])) : null;
}

function fromUtc(t: Date): Ymd {
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function addDays(a: Ymd, n: number): Ymd {
  return fromUtc(new Date(Date.UTC(a.y, a.m - 1, a.d + n)));
}
function addMonths(a: Ymd, n: number): Ymd {
  const first = new Date(Date.UTC(a.y, a.m - 1 + n, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  return { y, m, d: Math.min(a.d, daysInMonth(y, m)) };
}
/** 0 = lundi … 6 = dimanche. */
function weekday(a: Ymd): number {
  return (new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay() + 6) % 7;
}
function todayYmd(): Ymd {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}
function clampIso(a: Ymd, min?: string, max?: string): Ymd {
  const iso = toIso(a);
  if (min && iso < min) return parseIso(min) ?? a;
  if (max && iso > max) return parseIso(max) ?? a;
  return a;
}
const longLabel = (a: Ymd) => `${WEEKDAYS[weekday(a)]} ${a.d} ${MONTHS[a.m - 1]} ${a.y}`;

/** Texte affiché pour une valeur reçue : ISO → JJ/MM/AAAA, sinon telle quelle. */
function display(value: string | undefined): string {
  const p = parseIso(value);
  return p ? toFr(p) : (value ?? '');
}
/** Valeur transmise : ISO si la saisie est une date valide, '' si vide, sinon le texte brut (refusé par la validation). */
function emitted(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const p = parseInput(t);
  return p ? toIso(p) : t;
}

const subscribe = () => () => {};
/** Vrai après hydratation : avant (et sans JS), on rend le champ date natif. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Champ                                                               */
/* ------------------------------------------------------------------ */

interface DateFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  name?: string;
  /** Valeur contrôlée au format AAAA-MM-JJ (ou '' / saisie invalide brute). */
  value?: string;
  defaultValue?: string;
  /** Reçoit `e.target.value` : AAAA-MM-JJ, '' ou la saisie brute si elle n'est pas une date. */
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  /** Bornes AAAA-MM-JJ incluses. */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
}

const iconButtonClasses =
  'ui-btn ui-btn-secondary grid min-h-tap min-w-tap shrink-0 place-items-center border-2 border-ink bg-white text-ink hover:bg-c4 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Champ date : saisie clavier JJ/MM/AAAA + petit calendrier en français (lundi en premier).
 * La valeur soumise (input caché portant `name`) est au format ISO AAAA-MM-JJ. Sans JS
 * (avant hydratation), un `<input type="date">` natif équivalent est rendu.
 */
export function DateField({
  label,
  hint,
  error,
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required,
  disabled,
  className,
  wrapperClassName,
}: DateFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hydrated = useHydrated();
  const controlled = value !== undefined;

  const [text, setText] = useState(() => display(controlled ? value : defaultValue));
  const [expected, setExpected] = useState(controlled ? value : undefined);
  if (controlled && value !== expected) {
    // Valeur changée par le parent (réinitialisation, chargement) : on resynchronise l'affichage.
    setExpected(value);
    setText(display(value));
  }
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  const current = emitted(text);
  const minFr = parseIso(min);
  const maxFr = parseIso(max);
  const formatId = `${fieldId}-format`;
  const dialogId = `${fieldId}-calendar`;
  const described = [formatId, describedBy(fieldId, hint, error)].filter(Boolean).join(' ');

  function commit(nextText: string) {
    setText(nextText);
    const v = emitted(nextText);
    if (controlled) setExpected(v);
    onChange?.({ target: { value: v, name } });
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (!hydrated) {
    return (
      <Field id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
        <input
          id={fieldId}
          type="date"
          name={name}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          {...(controlled
            ? { value: parseIso(value) ? value : '', onChange: (e) => onChange?.({ target: { value: e.target.value, name } }) }
            : { defaultValue })}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={cn(controlClasses, className)}
        />
      </Field>
    );
  }

  const bounds =
    minFr && maxFr
      ? ` entre le ${toFr(minFr)} et le ${toFr(maxFr)}`
      : minFr
        ? ` à partir du ${toFr(minFr)}`
        : maxFr
          ? ` jusqu’au ${toFr(maxFr)}`
          : '';

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      <div
        ref={rootRef}
        className="relative"
        onBlur={(e) => {
          // Tabulation vers un élément extérieur : on referme (les clics extérieurs sont gérés à part).
          const to = e.relatedTarget as Node | null;
          if (open && to && !e.currentTarget.contains(to)) setOpen(false);
        }}
      >
        <div className="flex min-w-0 items-stretch gap-1.5">
          <input
            ref={textRef}
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="JJ/MM/AAAA"
            maxLength={10}
            required={required}
            disabled={disabled}
            value={text}
            onChange={(e) => {
              let next = e.target.value.replace(/[^\d/.\-\s]/g, '').replace(/\/{2,}/g, '/');
              // Barres obliques ajoutées au fil de la frappe (pas lors d'un effacement).
              if (next.length > text.length && /^\d{2}$|^\d{2}\/\d{2}$/.test(next)) next += '/';
              commit(next);
            }}
            onBlur={() => {
              const p = parseInput(text);
              if (p && toFr(p) !== text) commit(toFr(p));
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                setOpen(true);
              } else if (e.key === 'Escape' && open) {
                e.preventDefault();
                setOpen(false);
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
            className={cn(controlClasses, 'min-w-0 flex-1 tabular-nums', className)}
          />
          <button
            ref={toggleRef}
            type="button"
            className={iconButtonClasses}
            aria-label="Choisir la date dans le calendrier"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? dialogId : undefined}
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
          >
            <CalendarDays aria-hidden="true" className="size-5" />
          </button>
        </div>
        <span id={formatId} className="sr-only">
          {`Format JJ/MM/AAAA${bounds}.`}
        </span>
        {name ? <input type="hidden" name={name} value={current} /> : null}
        {open ? (
          <Calendar
            id={dialogId}
            selected={parseIso(current)}
            min={min}
            max={max}
            onSelect={(d) => {
              commit(toFr(d));
              setOpen(false);
              toggleRef.current?.focus();
            }}
            onClose={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
          />
        ) : null}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Calendrier                                                          */
/* ------------------------------------------------------------------ */

const navButtonClasses =
  'grid size-tap shrink-0 place-items-center text-ink hover:bg-c4 disabled:cursor-not-allowed disabled:opacity-30 [[data-admin-theme]_&]:rounded-sm';

function Calendar({
  id,
  selected,
  min,
  max,
  onSelect,
  onClose,
}: {
  id: string;
  selected: Ymd | null;
  min?: string;
  max?: string;
  onSelect: (d: Ymd) => void;
  onClose: () => void;
}) {
  const today = todayYmd();
  const todayIso = toIso(today);
  const [focus, setFocus] = useState<Ymd>(() => clampIso(selected ?? today, min, max));
  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(true); // focus initial sur le jour actif, puis après chaque déplacement clavier
  const titleId = `${id}-title`;
  const selectedIso = selected ? toIso(selected) : null;
  const focusIso = toIso(focus);
  const out = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusIso}"]`)?.focus();
  }, [focusIso]);

  const go = (next: Ymd, viaKeyboard: boolean) => {
    moveFocus.current = viaKeyboard;
    setFocus(viaKeyboard ? clampIso(next, min, max) : next);
  };

  const prevMonthLast = toIso(addDays({ ...focus, d: 1 }, -1));
  const nextMonthFirst = toIso(addMonths({ ...focus, d: 1 }, 1));
  const prevYearLast = toIso({ y: focus.y - 1, m: 12, d: 31 });
  const nextYearFirst = toIso({ y: focus.y + 1, m: 1, d: 1 });

  function onKey(e: KeyboardEvent<HTMLTableElement>) {
    const map: Record<string, () => Ymd> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    const f = map[e.key];
    if (!f) return;
    e.preventDefault();
    go(f(), true);
  }

  // Semaines du mois affiché (lundi en premier), cases vides hors du mois.
  const first: Ymd = { y: focus.y, m: focus.m, d: 1 };
  const lead = weekday(first);
  const total = daysInMonth(focus.y, focus.m);
  const cells: (Ymd | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => ({ y: focus.y, m: focus.m, d: i + 1 })),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const todayAllowed = !out(todayIso);

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="absolute left-0 top-full z-40 mt-1 w-[20.5rem] max-w-[calc(100vw-2rem)] border-2 border-ink bg-white p-2 text-ink"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={navButtonClasses}
          aria-label="Année précédente"
          disabled={Boolean(min && prevYearLast < min)}
          onClick={() => go(addMonths(focus, -12), false)}
        >
          <ChevronsLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          className={navButtonClasses}
          aria-label="Mois précédent"
          disabled={Boolean(min && prevMonthLast < min)}
          onClick={() => go(addMonths(focus, -1), false)}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <p id={titleId} aria-live="polite" className="flex-1 text-center font-bold first-letter:uppercase">
          {MONTHS[focus.m - 1]} {focus.y}
        </p>
        <button
          type="button"
          className={navButtonClasses}
          aria-label="Mois suivant"
          disabled={Boolean(max && nextMonthFirst > max)}
          onClick={() => go(addMonths(focus, 1), false)}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          className={navButtonClasses}
          aria-label="Année suivante"
          disabled={Boolean(max && nextYearFirst > max)}
          onClick={() => go(addMonths(focus, 12), false)}
        >
          <ChevronsRight aria-hidden="true" className="size-5" />
        </button>
      </div>

      <table ref={gridRef} role="grid" aria-labelledby={titleId} className="mt-1 w-full table-fixed border-collapse" onKeyDown={onKey}>
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w} scope="col" className="pb-1 text-center text-xs font-bold uppercase text-muted">
                <abbr title={w} className="no-underline">
                  {w.slice(0, 3)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (!day) return <td key={di} role="gridcell" />;
                const iso = toIso(day);
                const isSel = iso === selectedIso;
                const isToday = iso === todayIso;
                const disabled = out(iso);
                return (
                  <td key={di} role="gridcell" aria-selected={isSel} className="p-0 text-center">
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focusIso ? 0 : -1}
                      aria-label={`${longLabel(day)}${isToday ? ', aujourd’hui' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      aria-disabled={disabled || undefined}
                      onClick={() => {
                        if (!disabled) onSelect(day);
                      }}
                      className={cn(
                        'h-tap w-full tabular-nums [[data-admin-theme]_&]:rounded-sm',
                        isSel
                          ? 'bg-primary font-bold text-on-primary'
                          : disabled
                            ? 'cursor-not-allowed text-ink-2 line-through opacity-60'
                            : 'hover:bg-c4',
                        isToday && !isSel && 'font-black underline decoration-2 underline-offset-4',
                      )}
                    >
                      {day.d}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-1 flex justify-between gap-2 border-t-2 border-ink pt-1">
        <button
          type="button"
          className="min-h-tap px-2 text-sm font-bold underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
          disabled={!todayAllowed}
          onClick={() => onSelect(today)}
        >
          Aujourd’hui
        </button>
        <button
          type="button"
          className="min-h-tap px-2 text-sm font-bold underline underline-offset-4"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
