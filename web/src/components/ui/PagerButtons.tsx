'use client';

import type { PaginationMeta } from '@/lib/api/types';
import { Button } from './Button';

/** Pagination par boutons pour les listes pilotées par l'état (zone admin, espace prestataire). */
export function PagerButtons({
  meta,
  onPage,
  disabled,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  if (meta.last_page <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        disabled={disabled || meta.current_page <= 1}
        onClick={() => onPage(meta.current_page - 1)}
      >
        Précédent
      </Button>
      <p aria-live="polite" className="text-sm text-muted">
        Page {meta.current_page} sur {meta.last_page} ({meta.total} résultat{meta.total > 1 ? 's' : ''})
      </p>
      <Button
        variant="secondary"
        disabled={disabled || meta.current_page >= meta.last_page}
        onClick={() => onPage(meta.current_page + 1)}
      >
        Suivant
      </Button>
    </nav>
  );
}
