'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError, type SubmitError } from './api/errors';

/**
 * Exécute une action asynchrone sans réentrance : tant qu'un appel est en cours, les appels
 * suivants (double clic, rejeu) sont ignorés. Expose `busy` pour désactiver les boutons.
 */
export function useAsyncAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
    if (running.current) return { ok: false };
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (e) {
      setError(describeError(e));
      return { ok: false };
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy, error, clearError: () => setError(null) };
}

export interface ResourceState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (data: T | null) => void;
}

interface Loaded<T> {
  key: string;
  data: T | null;
  error: ApiError | null;
}

/**
 * Charge une ressource côté client ; un changement de `deps` ou `reload()` relance le chargement.
 * Les données déjà chargées restent disponibles pendant un rechargement ; les réponses périmées
 * sont ignorées.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[]): ResourceState<T> {
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: '', data: null, error: null });
  const loadRef = useRef(load);
  const key = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    loadRef
      .current()
      .then((data) => active && setLoaded({ key, data, error: null }))
      .catch((e) => {
        if (!active) return;
        const error =
          e instanceof ApiError
            ? e
            : new ApiError(500, 'Une erreur est survenue. Réessayez dans quelques instants.');
        setLoaded((prev) => ({ key, data: prev.data, error }));
      });
    return () => {
      active = false;
    };
  }, [key]);

  return {
    data: loaded.data,
    error: loaded.key === key ? loaded.error : null,
    loading: loaded.key !== key,
    reload: () => setTick((t) => t + 1),
    setData: (data) => setLoaded((prev) => ({ ...prev, data })),
  };
}
