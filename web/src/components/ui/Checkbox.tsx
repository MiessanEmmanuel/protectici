'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { FieldError } from './Field';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  error?: string;
  id?: string;
}

export function Checkbox({ label, error, id, className, ...rest }: CheckboxProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={className}>
      <div className="flex min-h-tap items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="mt-1.5 size-5 shrink-0 accent-primary"
          {...rest}
        />
        <label htmlFor={fieldId} className="py-1.5">
          {label}
        </label>
      </div>
      <FieldError id={`${fieldId}-error`} message={error} />
    </div>
  );
}
