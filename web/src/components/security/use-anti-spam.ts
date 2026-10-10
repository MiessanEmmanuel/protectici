'use client';

import { useCallback, useMemo, useState } from 'react';
import { turnstileSiteKey } from '@/lib/env';
import type { AntiSpamPayload } from '@/lib/api/types';

export const TURNSTILE_REQUIRED_MESSAGE =
  'Veuillez terminer la vérification anti-robot avant d’envoyer le formulaire.';

/**
 * État antispam d'un formulaire public (contrat §8.0) : champ piège + jeton Turnstile.
 * `<AntiSpamFields spam={spam} />` rend les deux ; `spam.payload()` s'ajoute au corps envoyé.
 */
export function useAntiSpam() {
  const enabled = turnstileSiteKey() !== '';
  const [token, setToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [resetSignal, setResetSignal] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);

  return useMemo(
    () => ({
      enabled,
      /** Faux tant que le défi Turnstile (s'il est actif) n'est pas résolu. */
      ready: !enabled || token !== null,
      /** Le champ piège est rempli : l'expéditeur est un robot (succès simulé côté client). */
      trapped: honeypot.trim() !== '',
      honeypot,
      setHoneypot,
      setToken,
      resetSignal,
      reset,
      payload(): AntiSpamPayload {
        return { ...(token ? { turnstile_token: token } : {}), company_website: honeypot };
      },
    }),
    [enabled, token, honeypot, resetSignal, reset],
  );
}

export type AntiSpam = ReturnType<typeof useAntiSpam>;
