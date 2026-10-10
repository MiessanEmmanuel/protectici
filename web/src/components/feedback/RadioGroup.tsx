'use client';

import { useId, type ReactNode } from 'react';
import { FieldError } from '../ui/Field';

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
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={described || undefined}>
      <legend className="font-semibold text-ink">
        {legend}
        {optional ? <span className="font-normal text-muted"> (facultatif)</span> : null}
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const inputId = `${id}-${o.value}`;
          return (
            <div
              key={o.value}
              className="flex min-h-tap items-center gap-3 rounded-md border border-line px-3"
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="size-5 shrink-0 accent-primary"
              />
              <label htmlFor={inputId} className="flex-1 py-2">
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
