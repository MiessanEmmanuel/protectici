'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { markBoxClasses, markInputClasses } from './Checkbox';
import { cn } from './cn';

type RadioControlProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Bouton radio seul : input natif transparent (focalisable, cible de 44 px) + rond dessiné.
 * À placer à côté d'un `<label htmlFor>` ; le groupe (fieldset/legend) reste à l'appelant.
 */
export function RadioControl({ className, ...rest }: RadioControlProps) {
  return (
    <span className={cn('relative mt-0.5 grid size-6 shrink-0 place-items-center', className)}>
      <input type="radio" className={markInputClasses} {...rest} />
      <span aria-hidden="true" className={cn(markBoxClasses, 'rounded-full')}>
        <span className="size-2.5 rounded-full bg-primary opacity-0 [:checked~*>&]:opacity-100" />
      </span>
    </span>
  );
}

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  hint?: ReactNode;
  id?: string;
}

/** Bouton radio étiqueté (aide facultative reliée par aria-describedby). */
export function Radio({ label, hint, id, className, ...rest }: RadioProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={cn('flex min-h-tap items-start gap-3 pt-1', className)}>
      <RadioControl
        id={fieldId}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
      <div className="flex-1">
        <label
          htmlFor={fieldId}
          className={cn('block py-0.5', rest.disabled ? 'cursor-not-allowed text-ink-2' : 'cursor-pointer')}
        >
          {label}
        </label>
        {hint ? (
          <p id={`${fieldId}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
