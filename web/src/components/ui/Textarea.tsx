'use client';

import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  rows = 4,
  ...rest
}: TextareaProps) {
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
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClasses, 'py-2', className)}
        {...rest}
      />
    </Field>
  );
}
