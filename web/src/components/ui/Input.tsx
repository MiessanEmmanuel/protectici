'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  ...rest
}: InputProps) {
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
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClasses, className)}
        {...rest}
      />
    </Field>
  );
}
