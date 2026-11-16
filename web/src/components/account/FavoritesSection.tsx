'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { Paginated, ProviderSummary } from '@/lib/api/types';
import { ProviderCard } from '../directory/ProviderCard';
import { Button, ButtonLink } from '../ui/Button';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';
import { useToast } from '../ui/Toast';

export function FavoritesSection() {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    data: Paginated<ProviderSummary> | null;
    error: string | null;
  } | null>(null);
  const id = `${page}:${attempt}`;
  const [removing, setRemoving] = useState<string | null>(null);
  const toast = useToast();

  async function remove(p: ProviderSummary, lastOnPage: boolean) {
    setRemoving(p.slug);
    try {
      await clientApi.removeFavorite(p.slug);
      toast.show(`« ${p.name} » a été retiré de vos favoris.`, 'success');
      if (lastOnPage && page > 1) setPage((n) => n - 1);
      else setAttempt((n) => n + 1);
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setRemoving(null);
    }
  }

  useEffect(() => {
    let active = true;
    clientApi
      .listFavorites(page)
      .then((data) => active && setResult({ id, data, error: null }))
      .catch((e) => active && setResult({ id, data: null, error: errorMessage(e) }));
    return () => {
      active = false;
    };
  }, [page, id]);

  const current = result && result.id === id ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  if (error) {
    return (
      <ErrorState
        title="Vos favoris n’ont pas pu être chargés"
        action={
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Réessayer
          </Button>
        }
      >
        {error}
      </ErrorState>
    );
  }
  if (!data) return <LoadingBlock label="Chargement de vos favoris…" />;
  if (data.data.length === 0) {
    return (
      <EmptyState
        title="Aucun favori pour le moment"
        action={<ButtonLink href="/annuaire">Parcourir l’annuaire</ButtonLink>}
      >
        Ajoutez un prestataire à vos favoris depuis sa fiche pour le retrouver ici.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {data.data.map((p) => (
          <li key={p.slug} className="flex flex-col gap-2">
            <ProviderCard provider={p} />
            <div>
              <Button
                variant="secondary"
                size="sm"
                loading={removing === p.slug}
                disabled={removing !== null && removing !== p.slug}
                aria-label={`Retirer ${p.name} de mes favoris`}
                onClick={() => void remove(p, data.data.length === 1)}
              >
                Retirer
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {data.meta.last_page > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
            Précédent
          </Button>
          <span>
            Page {data.meta.current_page} sur {data.meta.last_page}
          </span>
          <Button
            variant="secondary"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((n) => n + 1)}
          >
            Suivant
          </Button>
        </div>
      ) : null}
    </div>
  );
}
