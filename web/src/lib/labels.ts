import type {
  ContactStatus,
  FeedbackActionType,
  FeedbackStatus,
  FeedbackTargetType,
  QuoteRecipientStatus,
  QuoteStatus,
  ReviewReportReason,
  ReviewReportStatus,
  ReviewStatus,
  Executive,
  DocumentType,
  EstablishmentStatus,
  EstablishmentType,
  MediaCollection,
  ReferenceResource,
  Role,
  SubmitterRole,
} from './api/types';

export const POSITIONS: Record<Executive['position'], string> = {
  general_manager: 'Directeur général',
  commercial_manager: 'Responsable commercial',
  operations_manager: 'Responsable des opérations',
  other: 'Autre fonction',
};

export function positionLabel(e: Executive): string {
  return e.position === 'other' && e.position_label ? e.position_label : POSITIONS[e.position];
}

export const STATUS_LABELS: Record<EstablishmentStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente de validation',
  approved: 'Validé',
  rejected: 'Rejeté',
  suspended: 'Suspendu',
};

export const TYPE_LABELS: Record<EstablishmentType, string> = {
  provider: 'Prestataire privé',
  state_force: 'Administration étatique',
};

export const SUBMITTER_LABELS: Record<SubmitterRole, string> = {
  manager: 'Responsable ou dirigeant',
  employee: 'Employé',
  other: 'Autre',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  approval_certificate: 'Certificat d’agrément',
  rccm_extract: 'Extrait du RCCM',
  id_document: 'Pièce d’identité',
  other: 'Autre document',
};

export const COLLECTION_LABELS: Record<MediaCollection, string> = {
  logo: 'Logo',
  cover: 'Image de couverture',
  gallery: 'Galerie',
};

export const ROLE_LABELS: Record<Role, string> = {
  user: 'Utilisateur',
  provider: 'Prestataire',
  editor: 'Éditeur',
  admin: 'Administrateur',
};

export const REFERENCE_LABELS: Record<ReferenceResource, string> = {
  cities: 'Villes',
  districts: 'Quartiers',
  'company-types': 'Types d’entreprise',
  'service-types': 'Types de service',
  'state-force-types': 'Types de force étatique',
  'procedure-types': 'Types de démarche',
  'feedback-topics': 'Sujets « Dis-moi tout »',
  'post-categories': 'Catégories d’articles',
};

/** Libellés des champs sensibles / modifiables (demandes de modification, comparaisons). */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Raison sociale',
  rccm: 'Numéro RCCM',
  legal_form: 'Forme juridique',
  share_capital: 'Capital social (FCFA)',
  corporate_purpose: 'Objet social',
  approval_number: 'Numéro d’agrément',
  force_type_id: 'Type de structure',
};

const EVENT_LABELS: Record<string, string> = {
  account_status_changed: 'Statut de compte modifié',
  admin_created: 'Administrateur créé',
  change_request_approved: 'Demande de modification approuvée',
  change_request_cancelled: 'Demande de modification annulée',
  change_request_created: 'Demande de modification créée',
  change_request_rejected: 'Demande de modification rejetée',
  contact_message_replied: 'Réponse à un message de contact',
  contact_message_status_changed: 'Statut d’un message modifié',
  content_media_uploaded: 'Média de contenu ajouté',
  document_deleted: 'Justificatif supprimé',
  document_downloaded: 'Justificatif téléchargé',
  document_uploaded: 'Justificatif ajouté',
  email_verified: 'Adresse e-mail confirmée',
  establishment_approved: 'Établissement validé',
  establishment_created: 'Établissement inscrit',
  establishment_deleted: 'Établissement supprimé',
  establishment_rejected: 'Établissement rejeté',
  establishment_restored: 'Établissement restauré',
  establishment_resubmitted: 'Établissement soumis à nouveau',
  establishment_suspended: 'Établissement suspendu',
  feedback_assigned: 'Dossier « Dis-moi tout » affecté',
  feedback_replied: 'Réponse à un « Dis-moi tout »',
  feedback_status_changed: 'Statut d’un « Dis-moi tout » modifié',
  login_failed: 'Échec de connexion',
  login_failures_alert: 'Alerte : échecs de connexion répétés',
  login_succeeded: 'Connexion réussie',
  media_deleted: 'Média supprimé',
  media_uploaded: 'Média ajouté',
  newsletter_confirmed: 'Abonnement confirmé',
  newsletter_subscribers_listed: 'Liste des abonnés consultée',
  newsletter_unsubscribed: 'Désinscription de la newsletter',
  page_updated: 'Page modifiée',
  partner_deleted: 'Partenaire supprimé',
  password_changed: 'Mot de passe modifié',
  password_reset: 'Mot de passe réinitialisé',
  post_category_updated: 'Catégorie du blog modifiée',
  post_comment_moderated: 'Commentaire modéré',
  post_created: 'Article créé',
  post_deleted: 'Article supprimé',
  post_published_scheduled: 'Article planifié publié',
  post_updated: 'Article modifié',
  quote_dispatched: 'Devis acheminé',
  quote_status_changed: 'Statut d’un devis modifié',
  reference_created: 'Référentiel : valeur ajoutée',
  reference_deleted: 'Référentiel : valeur supprimée',
  reference_updated: 'Référentiel : valeur modifiée',
  review_approved: 'Avis approuvé',
  review_deleted: 'Avis supprimé',
  review_rejected: 'Avis rejeté',
  review_report_accepted: 'Signalement d’avis accepté',
  review_report_dismissed: 'Signalement d’avis rejeté',
  setting_updated: 'Paramètre modifié',
  two_factor_disabled: 'Double authentification désactivée',
  two_factor_enabled: 'Double authentification activée',
  two_factor_failed: 'Échec de double authentification',
  two_factor_lockout: 'Double authentification bloquée',
  unverified_registration_replaced: 'Inscription non confirmée remplacée',
  unverified_users_purged: 'Comptes non confirmés purgés',
  user_anonymized_by_admin: 'Utilisateur anonymisé',
  user_registered: 'Compte créé',
  'login.success': 'Connexion réussie',
  'login.failed': 'Échec de connexion',
  'establishment.submitted': 'Fiche soumise',
  'establishment.resubmitted': 'Fiche soumise à nouveau',
  'establishment.approved': 'Fiche approuvée',
  'establishment.rejected': 'Fiche rejetée',
  'establishment.suspended': 'Fiche suspendue',
  'establishment.restored': 'Fiche rétablie',
  'establishment.verified': 'Badge « vérifié » accordé',
  'establishment.unverified': 'Badge « vérifié » retiré',
  'establishment.updated': 'Fiche modifiée',
  'establishment.deleted': 'Fiche supprimée',
  'change_request.created': 'Demande de modification créée',
  'change_request.approved': 'Demande de modification approuvée',
  'change_request.rejected': 'Demande de modification rejetée',
  'document.downloaded': 'Justificatif consulté',
  role_changed: 'Rôle modifié',
  'user.anonymized': 'Compte anonymisé',
  'review.approved': 'Avis approuvé',
  'review.rejected': 'Avis rejeté',
  'review.deleted': 'Avis supprimé',
  'review_report.accepted': 'Signalement accepté',
  'review_report.dismissed': 'Signalement rejeté',
  'feedback.updated': 'Dossier « Dis-moi tout » mis à jour',
  'feedback.replied': 'Réponse « Dis-moi tout » envoyée',
  'quote.dispatched': 'Devis acheminé',
  'quote.updated': 'Devis mis à jour',
  'contact.updated': 'Message de contact mis à jour',
  'contact.replied': 'Réponse au message de contact envoyée',
};

/** Libellé français d'un événement d'audit ; l'identifiant brut est conservé s'il est inconnu. */
export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

/* ---------- Vague B ---------- */

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'En attente de modération',
  approved: 'Publié',
  rejected: 'Rejeté',
};

export const REPORT_REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: 'Publicité ou courrier indésirable',
  offensive: 'Propos injurieux ou offensants',
  false_info: 'Informations fausses ou trompeuses',
  other: 'Autre raison',
};

export const REPORT_STATUS_LABELS: Record<ReviewReportStatus, string> = {
  open: 'À traiter',
  accepted: 'Accepté',
  dismissed: 'Rejeté',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Reçu',
  in_progress: 'En cours de traitement',
  forwarded: 'Transmis au prestataire',
  resolved: 'Résolu',
  closed: 'Clôturé',
};

export const FEEDBACK_ACTION_LABELS: Record<FeedbackActionType, string> = {
  encouragement: 'Un encouragement',
  question: 'Une question',
  complaint: 'Une plainte',
  suggestion: 'Une suggestion',
};

export const FEEDBACK_TARGET_LABELS: Record<FeedbackTargetType, string> = {
  employee: 'Un employé',
  product: 'Un produit',
  service: 'Une prestation',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  new: 'Nouvelle',
  sent: 'Transmise',
  answered: 'Répondue',
  closed: 'Clôturée',
  cancelled: 'Annulée',
};

export const QUOTE_RECIPIENT_STATUS_LABELS: Record<QuoteRecipientStatus, string> = {
  sent: 'Reçu',
  viewed: 'Consulté',
  replied: 'Répondu',
  declined: 'Décliné',
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Nouveau',
  read: 'Lu',
  answered: 'Répondu',
  archived: 'Archivé',
};

/** Formes juridiques acceptées par l'API (valeurs d'`EstablishmentSchema::LEGAL_FORMS`). */
export const LEGAL_FORMS: Record<string, string> = {
  sarl: 'SARL',
  sa: 'SA',
  sas: 'SAS',
  suarl: 'SUARL',
  ei: 'Entreprise individuelle',
  association: 'Association',
  other: 'Autre',
};

export function legalFormLabel(value: string | null | undefined): string {
  if (!value) return '';
  return LEGAL_FORMS[value.toLowerCase()] ?? value;
}
