'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

/**
 * Affiche une référence de suivi (DMT-…, DEV-…) bien visible, avec copie dans le presse-papiers.
 * Le titre reçoit le focus à l'affichage (confirmation annoncée aux lecteurs d'écran).
 */
export function ReferenceCard({
  title,
  reference,
  message,
}: {
  title: string;
  reference: string;
  message?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  }

  return (
    <div className="flex flex-col gap-4 border-2 border-ink bg-c4 p-5 text-on-c4 md:p-8">
      <h2 ref={headingRef} tabIndex={-1} className="text-[2rem] heading-block outline-none">
        {title}
      </h2>
      {message ? <p>{message}</p> : null}
      <div>
        <p className="eyebrow">Votre numéro de référence</p>
        <p
          data-testid="reference"
          className="mt-2 break-all bg-c2 px-4 py-3 font-mono text-2xl font-black tracking-wide text-on-c2"
        >
          {reference}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void copy()}>
          Copier la référence
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {copied === 'ok' ? 'Référence copiée.' : null}
          {copied === 'fail' ? 'Copie impossible : sélectionnez la référence et copiez-la manuellement.' : null}
        </p>
      </div>
    </div>
  );
}
