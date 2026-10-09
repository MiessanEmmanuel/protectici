import { STATUS_LABELS } from '@/lib/labels';
import type { EstablishmentStatus } from '@/lib/api/types';
import { Badge } from './Tag';

const TONES = {
  draft: 'neutral',
  pending: 'accent',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
} as const;

/** Statut d'une fiche : toujours un libellé texte (jamais la couleur seule). */
export function StatusBadge({ status }: { status: EstablishmentStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
