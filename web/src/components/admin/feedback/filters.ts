import type { FeedbackStatus } from '@/lib/api/types';

const STATUSES: readonly FeedbackStatus[] = ['new', 'in_progress', 'forwarded', 'resolved', 'closed'];

/** Statut passé par lien (`?statut=`) : valeur inconnue ⇒ aucun filtre. */
export function parseFeedbackStatus(value: string | string[] | undefined): FeedbackStatus | '' {
  const v = Array.isArray(value) ? value[0] : value;
  return STATUSES.find((s) => s === v) ?? '';
}
