'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminDashboard } from '@/lib/api/types';

export type AdminCounts = Omit<AdminDashboard, 'recent_audit'>;

/** Éléments à traiter par entrée de navigation (seules les files exposées par le tableau de bord). */
export function navCounts(d: AdminCounts | null): Record<string, number> {
  if (!d) return {};
  return {
    '/admin/etablissements': d.pending_providers + d.pending_state_forces,
    '/admin/modifications': d.pending_change_requests,
    '/admin/avis': d.pending_reviews + d.open_review_reports,
    '/admin/dis-moi-tout': d.new_feedbacks,
    '/admin/devis': d.new_quote_requests,
    '/admin/messages': d.new_contact_messages,
    '/admin/commentaires': d.pending_comments,
    '/admin/revendications': d.pending_claims ?? 0,
  };
}

/** Total des éléments à traiter (mêmes compteurs que le tableau de bord). */
export function totalTodo(d: AdminCounts): number {
  return (
    d.pending_reviews +
    d.open_review_reports +
    d.new_feedbacks +
    d.new_quote_requests +
    d.new_contact_messages +
    d.pending_providers +
    d.pending_state_forces +
    d.pending_comments +
    d.pending_change_requests +
    (d.pending_claims ?? 0)
  );
}

/**
 * Compteurs de la barre latérale, relus à chaque changement d'écran (administrateurs seulement :
 * le tableau de bord est réservé au rôle admin côté API). Un échec laisse simplement les pastilles vides.
 */
export function useAdminCounts(enabled: boolean, pathname: string): AdminCounts | null {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    clientApi
      .adminDashboard()
      .then((d) => {
        if (!cancelled) setCounts(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);
  return enabled ? counts : null;
}
