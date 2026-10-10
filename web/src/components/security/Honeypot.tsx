'use client';

import type { ChangeEvent } from 'react';

/**
 * Champ piège anti-robot (contrat §8.0, nom `company_website`). Invisible et hors écran, exclu de
 * la tabulation, de l'autocomplétion et des technologies d'assistance. Un humain ne le remplit
 * jamais ; un robot qui le remplit reçoit un succès simulé et rien n'est enregistré.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto size-px overflow-hidden">
      <label>
        Ne pas remplir ce champ
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
