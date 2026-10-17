'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { controlClasses, describedBy, Field } from './Field';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  id?: string;
  wrapperClassName?: string;
}

/** Champ texte. En type « password », un bouton œil permet d'afficher ou de masquer la saisie. */
export function Input({
  label,
  hint,
  error,
  id,
  required,
  className,
  wrapperClassName,
  type,
  ...rest
}: InputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const input = (
    <input
      id={fieldId}
      type={isPassword && revealed ? 'text' : type}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(fieldId, hint, error)}
      className={cn(controlClasses, isPassword && 'pr-14', className)}
      {...rest}
    />
  );
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-controls={fieldId}
            aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute inset-y-0.5 right-0.5 inline-flex w-12 items-center justify-center text-ink hover:bg-c4 [&_svg]:size-5"
          >
            {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
