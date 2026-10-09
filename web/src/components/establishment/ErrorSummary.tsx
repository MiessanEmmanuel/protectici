'use client';

import { useEffect, useRef } from 'react';

/**
 * Résumé des erreurs d'un formulaire. Reçoit le focus quand `focusSignal` change (après un envoi
 * refusé), pour que les lecteurs d'écran annoncent immédiatement les problèmes.
 */
export function ErrorSummary({
  errors,
  focusSignal,
}: {
  errors: Record<string, string>;
  focusSignal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = Object.keys(errors);
  useEffect(() => {
    if (focusSignal > 0) ref.current?.focus();
  }, [focusSignal]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={keys.length ? 'alert' : undefined}
      className={keys.length ? 'rounded-md border border-danger bg-danger-soft p-3 text-danger' : 'sr-only'}
    >
      {keys.length ? (
        <>
          <p className="font-semibold">
            {keys.length === 1 ? 'Un champ est à corriger :' : `${keys.length} champs sont à corriger :`}
          </p>
          <ul className="list-disc pl-5">
            {keys.map((k) => (
              <li key={k}>{errors[k]}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
