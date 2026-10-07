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

/** Étiquette + aide + erreur associées au contrôle (aria-describedby fourni via describedBy). */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
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
      className="rounded-md border border-danger bg-danger-soft p-3 text-danger"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-success bg-success-soft p-3 text-success"
    >
      {message}
    </div>
  );
}

export const controlClasses =
  'min-h-tap w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-muted aria-[invalid=true]:border-danger disabled:bg-surface-alt';
