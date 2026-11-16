import type { DuplicateReason, ImportPublishMode, ImportStatus } from '@/lib/api/imports';
import type { EstablishmentType } from '@/lib/api/types';
import { Badge } from '../../ui/Tag';

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  uploaded: 'Fichier reçu',
  analyzing: 'Analyse en cours',
  ready: 'Prêt à importer',
  importing: 'Création en cours',
  done: 'Terminé',
  failed: 'Échec',
  cancelled: 'Annulé',
};

const TONES: Record<ImportStatus, 'success' | 'accent' | 'neutral' | 'danger' | 'primary'> = {
  uploaded: 'neutral',
  analyzing: 'primary',
  ready: 'accent',
  importing: 'primary',
  done: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

/** Types d'import au pluriel (choix du modèle, historique). */
export const IMPORT_TYPE_LABELS: Record<EstablishmentType, string> = {
  state_force: 'Forces étatiques',
  provider: 'Prestataires privés',
};

export const PUBLISH_MODE_LABELS: Record<ImportPublishMode, string> = {
  publish: 'Publication directe',
  pending: 'À valider',
};

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  name_city: 'même nom et même ville',
  phone: 'même téléphone',
  email: 'même e-mail',
  rccm: 'même RCCM',
  approval_number: 'même n° d’agrément',
  file: 'ligne en double dans le fichier',
};

/** Statuts pendant lesquels l'écran de suivi se rafraîchit toutes les 2 s (contrat §10.2). */
export function isRunning(status: ImportStatus): boolean {
  return status === 'analyzing' || status === 'importing' || status === 'uploaded';
}

export function ImportStatusBadge({
  status,
  cancelledAt,
}: {
  status: ImportStatus;
  cancelledAt?: string | null;
}) {
  // Un import terminé puis annulé garde le statut `done` avec `cancelled_at` posé.
  if (status === 'done' && cancelledAt) return <Badge tone="neutral">Annulé après import</Badge>;
  return <Badge tone={TONES[status]}>{IMPORT_STATUS_LABELS[status]}</Badge>;
}
