import type { CommentStatus, NewsletterStatus, PostStatus } from '@/lib/api/types';

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  published: 'Publié',
  archived: 'Archivé',
};

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  spam: 'Indésirable',
};

export const SUBSCRIBER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Confirmé',
  unsubscribed: 'Désinscrit',
};
