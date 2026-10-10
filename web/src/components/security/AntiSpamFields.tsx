'use client';

import { Honeypot } from './Honeypot';
import { Turnstile } from './Turnstile';
import type { AntiSpam } from './use-anti-spam';

/** Champ piège + Turnstile (si activé) à placer dans tout formulaire public. */
export function AntiSpamFields({ spam }: { spam: AntiSpam }) {
  return (
    <>
      <Honeypot value={spam.honeypot} onChange={spam.setHoneypot} />
      <Turnstile onToken={spam.setToken} resetSignal={spam.resetSignal} />
    </>
  );
}
