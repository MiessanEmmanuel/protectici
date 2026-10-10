import type { FeedbackInput } from '@/lib/api/types';
import type { PickedProvider } from '../directory/ProviderPicker';
import {
  feedbackStep1Schema,
  feedbackStep2Schema,
  feedbackStep3Schema,
  feedbackStep4Schema,
  feedbackStep5Schema,
} from '@/lib/wave-b-schemas';
import { validate, type FieldErrors } from '@/lib/validation';

/** Valeurs brutes des champs (chaînes), converties à l'envoi. */
export interface FeedbackDraft {
  civility: string;
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  provider: PickedProvider | null;
  action_type: string;
  target_type: string;
  service_type_id: string;
  topic_id: string;
  product_type: string;
  location: string;
  comment: string;
  consent: boolean;
}

export const emptyFeedbackDraft = (provider: PickedProvider | null = null): FeedbackDraft => ({
  civility: '',
  last_name: '',
  first_name: '',
  email: '',
  phone: '',
  provider,
  action_type: '',
  target_type: '',
  service_type_id: '',
  topic_id: '',
  product_type: '',
  location: '',
  comment: '',
  consent: false,
});

export const FEEDBACK_STEPS = [
  { id: 'info', label: 'Vos informations' },
  { id: 'provider', label: 'Prestataire concerné' },
  { id: 'action', label: 'Que désirez-vous faire ?' },
  { id: 'target', label: 'À propos de' },
  { id: 'review', label: 'Récapitulatif' },
] as const;

export type FeedbackStepId = (typeof FEEDBACK_STEPS)[number]['id'];

/** Étape portant chaque champ de l'API (retour au champ fautif après un 422). */
export function stepIndexOfField(field: string): number {
  const root = field.split('.')[0]!;
  if (['civility', 'last_name', 'first_name', 'email', 'phone'].includes(root)) return 0;
  if (root === 'provider_slug') return 1;
  if (root === 'action_type') return 2;
  if (
    ['target_type', 'service_type_id', 'topic_id', 'product_type', 'location', 'comment'].includes(root)
  )
    return 3;
  return 4;
}

export const TOPICS_UNAVAILABLE =
  'La liste des sujets est momentanément indisponible. Réessayez dans quelques instants.';

/** Valide une étape ; `topicsAvailable` faux bloque explicitement le sujet requis. */
export function validateFeedbackStep(
  index: number,
  d: FeedbackDraft,
  topicsAvailable: boolean,
): FieldErrors | null {
  let res;
  switch (index) {
    case 0:
      res = validate(feedbackStep1Schema, {
        civility: d.civility,
        last_name: d.last_name,
        first_name: d.first_name,
        email: d.email,
        phone: d.phone,
      });
      break;
    case 1:
      res = validate(feedbackStep2Schema, { provider_slug: d.provider?.slug ?? '' });
      break;
    case 2:
      res = validate(feedbackStep3Schema, { action_type: d.action_type });
      break;
    case 3:
      res = validate(feedbackStep4Schema, {
        target_type: d.target_type,
        service_type_id: d.service_type_id,
        topic_id: d.topic_id,
        product_type: d.product_type,
        location: d.location,
        comment: d.comment,
      });
      if (!res.ok && !topicsAvailable && res.errors.topic_id) {
        res.errors.topic_id = TOPICS_UNAVAILABLE;
      }
      if (res.ok && d.target_type !== 'product' && !topicsAvailable) {
        return { topic_id: TOPICS_UNAVAILABLE };
      }
      break;
    default:
      res = validate(feedbackStep5Schema, { consent: d.consent });
  }
  return res.ok ? null : res.errors;
}

/** Corps de la requête : uniquement les champs pertinents (contrat §8.2). */
export function buildFeedbackBody(d: FeedbackDraft): Omit<FeedbackInput, 'turnstile_token' | 'company_website'> {
  const body: Omit<FeedbackInput, 'turnstile_token' | 'company_website'> = {
    last_name: d.last_name.trim(),
    first_name: d.first_name.trim(),
    email: d.email.trim(),
    action_type: d.action_type as FeedbackInput['action_type'],
    target_type: d.target_type as FeedbackInput['target_type'],
    comment: d.comment.trim(),
    consent: d.consent,
  };
  if (d.civility) body.civility = d.civility as FeedbackInput['civility'];
  if (d.phone.trim()) body.phone = d.phone.trim();
  if (d.provider) body.provider_slug = d.provider.slug;
  if (d.target_type === 'service' && d.service_type_id) body.service_type_id = Number(d.service_type_id);
  if (d.target_type !== 'product' && d.topic_id) body.topic_id = Number(d.topic_id);
  if (d.target_type === 'product' && d.product_type.trim()) body.product_type = d.product_type.trim();
  if (d.location.trim()) body.location = d.location.trim();
  return body;
}
