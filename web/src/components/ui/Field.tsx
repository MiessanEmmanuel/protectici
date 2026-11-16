import type { ReactNode } from 'react';
import { cn } from './cn';

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function describedBy(id: string, hint?: ReactNode, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/**
 * Étiquette + aide + erreur associées au contrôle (aria-describedby fourni via describedBy).
 * L'aide est sous le contrôle : deux champs côte à côte restent alignés même si un seul en a une.
 */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-bold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Zone toujours présente : les lecteurs d'écran annoncent le message dès qu'il apparaît. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn('text-sm font-medium text-danger', !message && 'sr-only')}
    >
      {message ?? ''}
    </p>
  );
}

/** Message d'erreur global d'un formulaire (annoncé immédiatement). */
export function FormError({ message, title }: { message?: string | null; title?: string }) {
  if (!message) return <div role="alert" aria-live="assertive" className="sr-only" />;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-2 border-danger bg-danger-soft p-3 text-danger"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="border-2 border-success bg-success-soft p-3 text-success">
      {message}
    </div>
  );
}

/** Contrôle v9 : filet 2 px encre, angles droits, 50 px de haut, fond sable au focus. */
export const controlClasses =
  'ui-control min-h-btn w-full border-2 border-ink bg-white px-3 text-base text-ink placeholder:text-ink-2 focus:bg-c4 aria-[invalid=true]:border-danger disabled:bg-c4 disabled:text-ink-2';
