'use client';

import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
}

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function decimals(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/** Valeur après un pas (+1 / −1), alignée sur la grille min + k × step et bornée par min/max. */
export function stepValue(
  current: string,
  direction: 1 | -1,
  opts: { min?: number; max?: number; step?: number | 'any' },
): string {
  const step = opts.step === 'any' || !opts.step || opts.step <= 0 ? 1 : opts.step;
  const base = opts.min ?? 0;
  const cur = toNumber(current);
  let next: number;
  if (cur === undefined) {
    // Champ vide : le premier appui pose la valeur de départ (min, sinon 0).
    next = base;
  } else if (opts.step === 'any') {
    // Pas libre : on ajoute ou retire une unité sans réaligner la saisie.
    next = cur + direction;
  } else {
    const k = (cur - base) / step;
    const aligned = Math.abs(k - Math.round(k)) < 1e-9;
    const steps = aligned
      ? Math.round(k) + direction
      : direction === 1
        ? Math.ceil(k)
        : Math.floor(k);
    next = base + steps * step;
  }
  if (opts.min !== undefined) next = Math.max(opts.min, next);
  if (opts.max !== undefined) next = Math.min(opts.max, next);
  const precision = Math.max(decimals(step), decimals(base), cur !== undefined ? decimals(cur) : 0);
  return String(Number(next.toFixed(Math.min(precision, 10))));
}

/** Écrit la valeur comme le ferait l'utilisateur, pour que React déclenche onChange. */
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const stepButtonClasses =
  'ui-btn ui-btn-secondary grid min-h-tap min-w-tap shrink-0 place-items-center border-2 border-ink bg-white text-ink hover:bg-c4 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Champ numérique : input natif `type="number"` (validation min/max/step du navigateur, saisie
 * libre, flèches clavier) dont les flèches natives sont masquées, encadré de boutons − / +.
 * Même API que `Input` : `value`/`defaultValue`, `onChange(e)` avec `e.target.value` en chaîne.
 */
export function NumberField({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  disabled,
  readOnly,
  min,
  max,
  step,
  value,
  defaultValue,
  onChange,
  onInput,
  ...rest
}: NumberFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  const [uncontrolled, setUncontrolled] = useState(() =>
    defaultValue === undefined || defaultValue === null ? '' : String(defaultValue),
  );
  const current = value !== undefined && value !== null ? String(value) : uncontrolled;
  const nMin = toNumber(min);
  const nMax = toNumber(max);
  const nStep = step === 'any' ? 'any' : toNumber(step);
  const cur = toNumber(current);
  const atMin = nMin !== undefined && cur !== undefined && cur <= nMin;
  const atMax = nMax !== undefined && cur !== undefined && cur >= nMax;
  const inert = disabled || readOnly;
  const plainLabel = typeof label === 'string' ? label : undefined;

  function bump(direction: 1 | -1) {
    const input = ref.current;
    if (!input || inert) return;
    setNativeValue(input, stepValue(input.value, direction, { min: nMin, max: nMax, step: nStep }));
    input.focus();
  }

  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="flex min-w-0 items-stretch gap-1.5">
        <button
          type="button"
          className={stepButtonClasses}
          aria-label={plainLabel ? `Diminuer : ${plainLabel}` : 'Diminuer la valeur'}
          aria-controls={fieldId}
          disabled={inert || atMin}
          onClick={() => bump(-1)}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <input
          ref={ref}
          id={fieldId}
          type="number"
          inputMode={nStep === 'any' || (typeof nStep === 'number' && !Number.isInteger(nStep)) ? 'decimal' : 'numeric'}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={cn(
            controlClasses,
            'min-w-0 flex-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            className,
          )}
          onChange={onChange}
          onInput={(e) => {
            if (value === undefined) setUncontrolled(e.currentTarget.value);
            onInput?.(e);
          }}
          {...rest}
        />
        <button
          type="button"
          className={stepButtonClasses}
          aria-label={plainLabel ? `Augmenter : ${plainLabel}` : 'Augmenter la valeur'}
          aria-controls={fieldId}
          disabled={inert || atMax}
          onClick={() => bump(1)}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </Field>
  );
}
