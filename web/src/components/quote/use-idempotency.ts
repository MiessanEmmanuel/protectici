'use client';

import { useCallback, useRef } from 'react';
import { newIdempotencyKey } from '@/lib/uuid';

/**
 * Une clé d’idempotence par tentative logique de soumission : la même clé est renvoyée tant que le
 * contenu envoyé ne change pas (nouvel essai après échec réseau, 429 ou 5xx) ; elle est
 * régénérée quand les données changent ou après un succès (`renew`).
 */
export function useIdempotencyKey() {
  const current = useRef<{ key: string; fingerprint: string } | null>(null);

  const keyFor = useCallback((fingerprint: string): string => {
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { key: newIdempotencyKey(), fingerprint };
    }
    return current.current.key;
  }, []);

  const renew = useCallback(() => {
    current.current = null;
  }, []);

  return { keyFor, renew };
}

/** Empreinte du corps envoyé, sans le jeton Turnstile (à usage unique, donc différent à chaque essai). */
export function bodyFingerprint(body: Record<string, unknown>): string {
  const { turnstile_token: _token, ...rest } = body;
  void _token;
  return JSON.stringify(rest);
}
