'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  children,
  ...rest
}: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClasses, className)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}
