'use client';

import { useId, type ReactNode } from 'react';
import { FieldError } from '../ui/Field';
import { RadioControl } from '../ui/Radio';

export interface RadioOption<V extends string> {
  value: V;
  label: string;
}

/** Groupe de boutons radio accessible : fieldset + legend, erreur liée, cibles de 44 px. */
export function RadioGroup<V extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  optional,
}: {
  legend: ReactNode;
  name: string;
  options: RadioOption<V>[];
  value: V | '';
  onChange: (value: V) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={described || undefined}>
      <legend className="mb-1 font-bold text-ink">
        {legend}
        {optional ? <span className="font-normal text-ink-2"> (facultatif)</span> : null}
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const inputId = `${id}-${o.value}`;
          return (
            <div
              key={o.value}
              className="flex min-h-btn items-center gap-3 border-2 border-ink bg-white px-3 font-semibold has-checked:bg-c4 has-checked:font-extrabold has-focus-visible:outline-3 has-focus-visible:outline-ink"
            >
              <RadioControl
                id={inputId}
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="mt-0"
              />
              <label htmlFor={inputId} className="flex-1 cursor-pointer py-2">
                {o.label}
              </label>
            </div>
          );
        })}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
