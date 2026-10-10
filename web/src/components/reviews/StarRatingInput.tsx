'use client';

import { useId, useRef } from 'react';
import { cn } from '../ui/cn';
import { FieldError } from '../ui/Field';

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Saisie de note accessible : groupe de boutons radio (flèches, Début/Fin), 44 px minimum,
 * et valeur toujours écrite en toutes lettres (« 3 sur 5 ») en plus des étoiles.
 */
export function StarRatingInput({
  value,
  onChange,
  label = 'Votre note',
  error,
  disabled,
  required,
}: Props) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(next: number) {
    onChange(next);
    refs.current[next - 1]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, current: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = current === 5 ? 1 : current + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = current === 1 ? 5 : current - 1;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 5;
    if (next === null) return;
    e.preventDefault();
    select(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="font-semibold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-value${error ? ` ${id}-error` : ''}`}
        className="flex flex-wrap items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sur 5`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-md border disabled:opacity-60',
              value === n ? 'border-primary bg-primary-soft' : 'border-transparent',
            )}
          >
            <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true" focusable="false">
              <path
                d={STAR}
                strokeWidth="1.5"
                strokeLinejoin="round"
                className={cn(
                  'stroke-accent-text',
                  n <= value ? 'fill-accent' : 'fill-surface',
                )}
              />
            </svg>
          </button>
        ))}
        <span id={`${id}-value`} className="ms-2 text-sm text-muted">
          {value ? `${value} sur 5` : 'Aucune note choisie'}
        </span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
