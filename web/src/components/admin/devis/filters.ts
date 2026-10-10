import type { QuoteStatus } from '@/lib/api/types';

const STATUSES: readonly QuoteStatus[] = ['new', 'sent', 'answered', 'closed', 'cancelled'];

/** Statut passé par lien (`?statut=`) : valeur inconnue ⇒ aucun filtre. */
export function parseQuoteStatus(value: string | string[] | undefined): QuoteStatus | '' {
  const v = Array.isArray(value) ? value[0] : value;
  return STATUSES.find((s) => s === v) ?? '';
}
