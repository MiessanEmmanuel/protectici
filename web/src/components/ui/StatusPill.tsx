import {
  CONTACT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
  QUOTE_RECIPIENT_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from '@/lib/labels';
import { Badge } from './Tag';

type Tone = 'success' | 'accent' | 'neutral' | 'danger';

const MAP = {
  review: {
    labels: REVIEW_STATUS_LABELS,
    tones: { pending: 'accent', approved: 'success', rejected: 'danger' },
  },
  report: {
    labels: REPORT_STATUS_LABELS,
    tones: { open: 'accent', accepted: 'success', dismissed: 'neutral' },
  },
  feedback: {
    labels: FEEDBACK_STATUS_LABELS,
    tones: {
      new: 'accent',
      in_progress: 'accent',
      forwarded: 'neutral',
      resolved: 'success',
      closed: 'neutral',
    },
  },
  quote: {
    labels: QUOTE_STATUS_LABELS,
    tones: { new: 'accent', sent: 'neutral', answered: 'success', closed: 'neutral', cancelled: 'danger' },
  },
  recipient: {
    labels: QUOTE_RECIPIENT_STATUS_LABELS,
    tones: { sent: 'accent', viewed: 'neutral', replied: 'success', declined: 'danger' },
  },
  contact: {
    labels: CONTACT_STATUS_LABELS,
    tones: { new: 'accent', read: 'neutral', answered: 'success', archived: 'neutral' },
  },
} as const satisfies Record<string, { labels: Record<string, string>; tones: Record<string, Tone> }>;

export type StatusKind = keyof typeof MAP;

/** Badge de statut (vague B) : toujours un libellé texte, jamais la couleur seule. */
export function StatusPill({ kind, status }: { kind: StatusKind; status: string }) {
  const entry = MAP[kind] as { labels: Record<string, string>; tones: Record<string, Tone> };
  return <Badge tone={entry.tones[status] ?? 'neutral'}>{entry.labels[status] ?? status}</Badge>;
}
