'use client';

import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { FieldError } from './Field';
import { cn } from './cn';

/**
 * Habillage commun des cases et boutons radio : l'input natif reste présent, focalisable et
 * cliquable (transparent, posé sur une zone de 44 px), la marque visible est dessinée à côté.
 * Les couleurs viennent des jetons (`primary`, `ink`, `danger`, `white`) : angles droits et
 * filets 2 px sur le site public, coins adoucis dans l'administration ([data-admin-theme]).
 */
export const markInputClasses =
  'peer absolute -inset-2.5 z-10 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed';

export const markBoxClasses =
  'pointer-events-none grid size-5 shrink-0 place-items-center border-[2px] border-[color:var(--color-ink)] bg-white text-on-primary transition-colors ' +
  '[[data-admin-theme]_&]:border-[color:var(--color-ink-2)] ' +
  'peer-checked:border-[color:var(--color-primary)] ' +
  'peer-indeterminate:border-[color:var(--color-primary)] ' +
  'peer-aria-[invalid=true]:border-[color:var(--color-danger)] ' +
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ' +
  'peer-disabled:opacity-50';

interface CheckboxControlProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** État « partiellement coché » (affiché par un trait). */
  indeterminate?: boolean;
}

/** Case seule (input natif + marque dessinée), à placer à côté d'un `<label htmlFor>`. */
export function CheckboxControl({ indeterminate, className, ...rest }: CheckboxControlProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <span className={cn('relative mt-0.5 grid size-6 shrink-0 place-items-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        className={markInputClasses}
        {...rest}
      />
      <span aria-hidden="true" className={cn(
          markBoxClasses,
          'peer-checked:bg-primary peer-indeterminate:bg-primary [[data-admin-theme]_&]:rounded-[5px]',
        )}>
        <svg
          viewBox="0 0 16 16"
          className="size-3.5 opacity-0 [:checked~*>&]:opacity-100 [:indeterminate~*>&]:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
        >
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
        <span className="hidden h-0.5 w-2.5 bg-current [:indeterminate~*>&]:block" />
      </span>
    </span>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  id?: string;
  indeterminate?: boolean;
}

export function Checkbox({ label, error, hint, id, className, indeterminate, ...rest }: CheckboxProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const described =
    [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={className}>
      <div className="flex min-h-tap items-start gap-3 pt-1">
        <CheckboxControl
          id={fieldId}
          indeterminate={indeterminate}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          {...rest}
        />
        <div className="flex-1">
          <label htmlFor={fieldId} className={cn('block py-0.5', rest.disabled ? 'cursor-not-allowed text-ink-2' : 'cursor-pointer')}>
            {label}
          </label>
          {hint ? (
            <p id={`${fieldId}-hint`} className="text-sm text-muted">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      <FieldError id={`${fieldId}-error`} message={error} />
    </div>
  );
}
