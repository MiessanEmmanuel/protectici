import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/validation';
import {
  contactSchema,
  feedbackStep1Schema,
  feedbackStep3Schema,
  feedbackStep4Schema,
  feedbackStep5Schema,
  feedbackTrackSchema,
  quoteReplySchema,
  quoteSchema,
  rejectReasonSchema,
  reviewReplySchema,
  reviewSchema,
  todayIso,
} from '@/lib/wave-b-schemas';

describe('schémas vague B', () => {
  it('feedback étape 1 : nom, prénoms et e-mail requis', () => {
    const r = validate(feedbackStep1Schema, { last_name: '', first_name: '', email: 'x', phone: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'first_name', 'last_name']);
  });

  it('feedback étape 3 : action obligatoire', () => {
    expect(validate(feedbackStep3Schema, {}).ok).toBe(false);
    expect(validate(feedbackStep3Schema, { action_type: 'complaint' }).ok).toBe(true);
  });

  it('feedback étape 4 : règles conditionnelles prestation/sujet/produit', () => {
    const base = { comment: 'Un commentaire suffisamment long.' };
    const service = validate(feedbackStep4Schema, { ...base, target_type: 'service' });
    expect(service.ok).toBe(false);
    if (!service.ok) expect(Object.keys(service.errors).sort()).toEqual(['service_type_id', 'topic_id']);
    const product = validate(feedbackStep4Schema, { ...base, target_type: 'product' });
    expect(product.ok).toBe(true);
    const employee = validate(feedbackStep4Schema, { ...base, target_type: 'employee', topic_id: '3' });
    expect(employee.ok && employee.data.topic_id).toBe(3);
    expect(validate(feedbackStep4Schema, { target_type: 'product', comment: 'court' }).ok).toBe(false);
    expect(validate(feedbackStep4Schema, { target_type: 'product', comment: 'x'.repeat(3001) }).ok).toBe(false);
  });

  it('feedback étape 5 : consentement obligatoire', () => {
    expect(validate(feedbackStep5Schema, { consent: false }).ok).toBe(false);
    expect(validate(feedbackStep5Schema, { consent: true }).ok).toBe(true);
  });

  it('suivi : référence mise en majuscules, e-mail valide', () => {
    const r = validate(feedbackTrackSchema, { reference: ' dmt-2026-000101 ', email: 'a@b.co' });
    expect(r.ok && r.data.reference).toBe('DMT-2026-000101');
    expect(validate(feedbackTrackSchema, { reference: '', email: 'a@b.co' }).ok).toBe(false);
  });

  it('devis : bornes, date passée et plafond de prestataires', () => {
    const ok = {
      first_name: 'Awa',
      last_name: 'Koné',
      email: 'awa@example.test',
      phone: '+2250700000000',
      service_type_id: '2',
      city_id: '1',
      description: 'Gardiennage de nuit pour un entrepôt de stockage.',
      consent: true,
    };
    const good = validate(quoteSchema, ok);
    expect(good.ok && good.data.service_type_id).toBe(2);
    expect(validate(quoteSchema, { ...ok, description: 'trop court' }).ok).toBe(false);
    expect(validate(quoteSchema, { ...ok, desired_start_date: '2020-01-01' }).ok).toBe(false);
    expect(validate(quoteSchema, { ...ok, desired_start_date: todayIso() }).ok).toBe(true);
    expect(validate(quoteSchema, { ...ok, provider_slugs: ['a', 'b', 'c', 'd', 'e', 'f'] }).ok).toBe(false);
    expect(validate(quoteSchema, { ...ok, budget_range: 'x'.repeat(51) }).ok).toBe(false);
    expect(validate(quoteSchema, { ...ok, consent: false }).ok).toBe(false);
  });

  it('contact : objet ≤ 200 et message 10–5000', () => {
    const ok = { name: 'A', email: 'a@b.co', subject: 'Bonjour', message: 'Un message correct.', consent: true };
    expect(validate(contactSchema, ok).ok).toBe(true);
    expect(validate(contactSchema, { ...ok, subject: 'x'.repeat(201) }).ok).toBe(false);
    expect(validate(contactSchema, { ...ok, message: 'court' }).ok).toBe(false);
  });

  it('avis : note 1–5, texte 10–3000, titre ≤ 150', () => {
    const ok = { rating: 4, body: 'Un avis détaillé et honnête.' };
    expect(validate(reviewSchema, ok).ok).toBe(true);
    expect(validate(reviewSchema, { ...ok, rating: 0 }).ok).toBe(false);
    expect(validate(reviewSchema, { ...ok, rating: 6 }).ok).toBe(false);
    expect(validate(reviewSchema, { ...ok, title: 'x'.repeat(151) }).ok).toBe(false);
    expect(validate(reviewSchema, { ...ok, body: 'court' }).ok).toBe(false);
  });

  it('réponses et motifs : bornes', () => {
    expect(validate(reviewReplySchema, { body: 'Merci' }).ok).toBe(true);
    expect(validate(reviewReplySchema, { body: 'Non' }).ok).toBe(false);
    expect(validate(rejectReasonSchema, { reason: 'trop bref' }).ok).toBe(false);
    expect(validate(rejectReasonSchema, { reason: 'Motif suffisamment détaillé.' }).ok).toBe(true);
    const amount = validate(quoteReplySchema, { message: 'Voici notre proposition.', quoted_amount: '1 500 000' });
    expect(amount.ok && amount.data.quoted_amount).toBe(1500000);
    expect(validate(quoteReplySchema, { message: 'Voici notre proposition.', quoted_amount: '12,5' }).ok).toBe(false);
    const none = validate(quoteReplySchema, { message: 'Voici notre proposition.', quoted_amount: '' });
    expect(none.ok && none.data.quoted_amount).toBeNull();
  });
});
