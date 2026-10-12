'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  parseConsent,
  readConsentRaw,
  writeConsent,
  type ConsentCategory,
} from '@/lib/consent';
import { Button } from '../ui/Button';

const SERVER = '\u0000server';

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, cb);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, cb);
}
const getRaw = () => readConsentRaw() ?? '';

/** Lit le choix courant (null = aucun choix valide ou expiré). `undefined` pendant l'hydratation. */
function useConsentChoice() {
  const raw = useSyncExternalStore(subscribe, getRaw, () => SERVER);
  if (raw === SERVER) return undefined;
  return parseConsent(raw);
}

/**
 * Bandeau de consentement : « Tout refuser » et « Tout accepter » ont exactement le même rendu.
 * Tant qu'aucun choix n'est fait, rien de non essentiel n'est chargé (voir ConsentGate). Le choix
 * est conservé 6 mois dans le cookie `pi_consent` ; il peut être modifié via le pied de page.
 */
export function CookieConsent() {
  const choice = useConsentChoice();
  const [reopened, setReopened] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const visible = choice === null || reopened;
  useEffect(() => {
    if (reopened) titleRef.current?.focus();
  }, [reopened]);

  if (choice === undefined || !visible) return null;

  function decide(analytics: boolean) {
    writeConsent(analytics);
    setReopened(false);
  }

  return (
    <section
      aria-labelledby="titre-cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-overlay"
    >
      <div className="mx-auto flex max-w-page flex-col gap-3 sm:px-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <h2 id="titre-cookies" ref={titleRef} tabIndex={-1} className="text-lg font-bold outline-none">
            Vos choix en matière de cookies
          </h2>
          <p className="mt-1 text-sm">
            ProtectIci utilise uniquement les cookies indispensables au fonctionnement du site
            (connexion, sécurité). Avec votre accord, nous pourrions aussi mesurer l’audience de
            façon anonyme. Aucun traceur facultatif n’est activé avant votre choix, que vous pouvez
            modifier à tout moment. En savoir plus dans la{' '}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" size="lg" onClick={() => decide(false)}>
            Tout refuser
          </Button>
          <Button variant="secondary" size="lg" onClick={() => decide(true)}>
            Tout accepter
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Affiche ses enfants seulement si la catégorie de cookies a été acceptée (jamais avant accord). */
export function ConsentGate({
  category = 'analytics',
  children,
}: {
  category?: ConsentCategory;
  children: ReactNode;
}) {
  const choice = useConsentChoice();
  return choice?.[category] === true ? <>{children}</> : null;
}
