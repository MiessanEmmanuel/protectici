'use client';

import type { ReactNode } from 'react';
import { Checkbox } from '../ui/Checkbox';
import { FieldError } from '../ui/Field';
import { cn } from '../ui/cn';

interface Option<V> {
  value: V;
  label: string;
  hint?: string;
}

interface GroupProps {
  /** Identifiant du premier contrôle (cible du résumé d'erreurs). */
  id: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

function Legend({ legend, required }: { legend: ReactNode; required?: boolean }) {
  return (
    <legend className="px-1 font-semibold">
      {legend}
      {required ? (
        <span aria-hidden="true" className="text-danger">
          {' '}
          *
        </span>
      ) : null}
    </legend>
  );
}

/** Groupe de cases à cocher (fieldset/legend) pour une sélection multiple d'identifiants. */
export function CheckboxGroup({
  id,
  legend,
  hint,
  error,
  required,
  disabled,
  className,
  options,
  selected,
  onChange,
}: GroupProps & {
  options: Option<number>[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <fieldset
      className={cn('rounded-lg border border-line p-3', className)}
      disabled={disabled}
      aria-describedby={error ? `${id}-group-error` : undefined}
    >
      <Legend legend={legend} required={required} />
      {hint ? <p className="mb-1 text-sm text-muted">{hint}</p> : null}
      <div className="grid gap-x-4 sm:grid-cols-2">
        {options.map((o, i) => (
          <Checkbox
            key={o.value}
            id={i === 0 ? id : `${id}-${o.value}`}
            label={o.label}
            checked={selected.includes(o.value)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value),
              )
            }
          />
        ))}
      </div>
      <FieldError id={`${id}-group-error`} message={error} />
    </fieldset>
  );
}

/** Groupe de boutons radio (choix unique). */
export function RadioGroup<V extends string>({
  id,
  legend,
  hint,
  error,
  required,
  disabled,
  className,
  name,
  options,
  value,
  onChange,
}: GroupProps & {
  name: string;
  options: Option<V>[];
  value: V | '';
  onChange: (next: V) => void;
}) {
  return (
    <fieldset
      className={cn('rounded-lg border border-line p-3', className)}
      disabled={disabled}
      aria-describedby={error ? `${id}-group-error` : undefined}
    >
      <Legend legend={legend} required={required} />
      {hint ? <p className="mb-1 text-sm text-muted">{hint}</p> : null}
      <div className="flex flex-col">
        {options.map((o, i) => {
          const oid = i === 0 ? id : `${id}-${o.value}`;
          return (
            <div key={o.value} className="flex min-h-tap items-start gap-3">
              <input
                id={oid}
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                aria-describedby={o.hint ? `${oid}-hint` : undefined}
                className="mt-1.5 size-5 shrink-0 accent-primary"
              />
              <label htmlFor={oid} className="py-1.5">
                <span className="font-medium">{o.label}</span>
                {o.hint ? (
                  <span id={`${oid}-hint`} className="block text-sm text-muted">
                    {o.hint}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
      <FieldError id={`${id}-group-error`} message={error} />
    </fieldset>
  );
}
