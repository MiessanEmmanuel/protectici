import type {
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
};

/** Libellé français d'un événement d'audit ; l'identifiant brut est conservé s'il est inconnu. */
export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}
