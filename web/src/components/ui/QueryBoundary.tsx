'use client';

import type { ReactNode } from 'react';
import type { ResourceState } from '@/lib/use-async';
import { Button } from './Button';
import { ErrorState } from './EmptyState';
import { LoadingBlock } from './Spinner';

/**
 * Rendu standard d'une ressource chargée côté client : chargement, erreur (401/403/404/429/réseau)
 * avec bouton « Réessayer » quand c'est pertinent, puis contenu. Les données déjà affichées
 * restent visibles pendant un rechargement.
 */
export function QueryBoundary<T>({
  state,
  children,
  loadingLabel = 'Chargement…',
}: {
  state: ResourceState<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (state.data === null) {
    if (state.loading) return <LoadingBlock label={loadingLabel} />;
    const err = state.error;
    const retry = err && err.status !== 403 && err.status !== 404 && err.status !== 401;
    return (
      <ErrorState
        title={
          err?.status === 403
            ? 'Accès refusé'
            : err?.status === 404
              ? 'Introuvable'
              : err?.status === 401
                ? 'Connexion requise'
                : 'Un problème est survenu'
        }
        action={
          retry ? (
            <Button variant="secondary" onClick={state.reload}>
              Réessayer
            </Button>
          ) : undefined
        }
      >
        {err?.message}
      </ErrorState>
    );
  }
  return <>{children(state.data)}</>;
}
