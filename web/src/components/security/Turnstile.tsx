'use client';

import { useEffect, useRef, useState } from 'react';
import { turnstileSiteKey } from '@/lib/env';
import { Button } from '../ui/Button';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      language?: string;
      theme?: string;
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Charge le script Cloudflare une seule fois ; résout quand `window.turnstile` est prêt. */
function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')),
    );
    script.addEventListener('error', () => reject(new Error('turnstile')));
  });
}

type Phase = 'loading' | 'ready' | 'expired' | 'error';

/**
 * Widget Cloudflare Turnstile. Ne rend RIEN et ne charge aucun script si
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` n'est pas défini. Le jeton obtenu est transmis à `onToken`
 * (null à l'expiration ou en cas d'erreur). `resetSignal` incrémenté => nouveau défi.
 */
export function Turnstile({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const siteKey = turnstileSiteKey();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !container.current) return;
        if (widgetId.current) api.remove(widgetId.current);
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          language: 'fr',
          callback: (token) => {
            setPhase('ready');
            onTokenRef.current(token);
          },
          'expired-callback': () => {
            setPhase('expired');
            onTokenRef.current(null);
          },
          'error-callback': () => {
            setPhase('error');
            onTokenRef.current(null);
          },
        });
        setPhase('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setPhase('error');
        onTokenRef.current(null);
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, attempt]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onTokenRef.current(null);
    }
  }, [resetSignal]);

  if (!siteKey) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="turnstile">
      <p className="text-sm font-semibold">Vérification anti-robot</p>
      <div ref={container} />
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {phase === 'loading' ? 'Chargement de la vérification…' : null}
        {phase === 'expired' ? 'La vérification a expiré. Elle va se renouveler, ou cliquez sur « Relancer ».' : null}
      </p>
      {phase === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-danger">
          <span>La vérification anti-robot a échoué. Vérifiez votre connexion puis relancez-la.</span>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Relancer la vérification
          </Button>
        </div>
      ) : null}
    </div>
  );
}
