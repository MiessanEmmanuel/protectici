import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '@/lib/api/endpoints';

let mockApi: Api;
beforeAll(async () => {
  mockApi = (await import('@/lib/mocks/mock-api')).mockApi;
});

async function loginAs(email: string) {
  const r = await mockApi.login({ email, password: 'motdepasse' });
  if (r.kind === 'two_factor') await mockApi.twoFactorChallenge({ code: '123456' });
}

const feedbackBody = {
  last_name: 'Koné', first_name: 'Awa', email: 'nouveau@example.test', action_type: 'question' as const,
  target_type: 'product' as const, comment: 'Une question suffisamment détaillée.', consent: true,
};

describe('mock vague B : avis', () => {
  beforeEach(async () => {
    await mockApi.logout();
  });

  it('création : en attente, non publié ; 409 au second avis ; propriétaire = 403', async () => {
    await loginAs('nouveau@example.test');
    const slug = 'flamme-securite-incendie';
    const review = await mockApi.createReview(slug, { rating: 5, body: 'Un service irréprochable.' });
    expect(review.status).toBe('pending');
    expect(review.is_visible).toBe(false);
    const public1 = await mockApi.listProviderReviews(slug, 1, 50);
    expect(public1.data.some((r) => r.id === review.id)).toBe(false);
    await expect(mockApi.createReview(slug, { rating: 4, body: 'Un deuxième avis valide.' })).rejects.toMatchObject({ status: 409 });
    await mockApi.logout();
    await loginAs('proprietaire1@example.test');
    const own = (await mockApi.listProviders({ sort: 'name' })).data[0]!;
    void own;
    await expect(mockApi.createReview('sentinelle-securite-abidjan', { rating: 5, body: 'Mon propre avis ici.' })).rejects.toMatchObject({ status: 403 });
  });

  it('modération : approuver publie, rejeter exige un motif et reste idempotent', async () => {
    await loginAs('nouveau2@example.test');
    const review = await mockApi.createReview('cerbere-brigade-canine', { rating: 3, body: 'Service moyen, correct.' });
    await mockApi.logout();
    await loginAs('admin@example.test');
    await expect(mockApi.adminReviewAction(review.id, 'reject', 'court')).rejects.toMatchObject({ status: 422 });
    await mockApi.adminReviewAction(review.id, 'reject', 'Avis trop vague pour être publié.');
    await mockApi.adminReviewAction(review.id, 'reject', 'Avis trop vague pour être publié.');
    await mockApi.adminReviewAction(review.id, 'approve');
    await mockApi.adminReviewAction(review.id, 'approve');
    const pub = await mockApi.listProviderReviews('cerbere-brigade-canine', 1, 50);
    expect(pub.data.filter((r) => r.id === review.id)).toHaveLength(1);
  });

  it('modifier un avis le remet en attente ; le supprimer le retire', async () => {
    await loginAs('client.demo@example.test');
    const mine = await mockApi.listMyReviews();
    expect(mine.data.map((r) => r.status).sort()).toEqual(['approved', 'pending', 'rejected']);
    expect(mine.data.find((r) => r.status === 'rejected')?.rejection_reason).toMatch(/.{10,}/);
    const approved = mine.data.find((r) => r.status === 'approved')!;
    const updated = await mockApi.updateMyReview(approved.id, { body: 'Texte modifié et plus complet.' });
    expect(updated.status).toBe('pending');
    await mockApi.deleteMyReview(approved.id);
    expect((await mockApi.listMyReviews()).data.some((r) => r.id === approved.id)).toBe(false);
    await expect(mockApi.updateMyReview(approved.id, { body: 'Encore une modification.' })).rejects.toMatchObject({ status: 404 });
  });

  it('signalement : rejeu accepté, accepter masque l’avis', async () => {
    await loginAs('admin@example.test');
    const reports = await mockApi.adminListReviewReports();
    const first = reports.data[0]!;
    await mockApi.adminReviewReportAction(first.id, 'accept');
    await mockApi.adminReviewReportAction(first.id, 'accept');
    const accepted = await mockApi.adminListReviewReports({ status: 'accepted' });
    expect(accepted.data.some((r) => r.id === first.id)).toBe(true);
    await mockApi.logout();
    await loginAs('lecteur@example.test');
    await expect(mockApi.reportReview(first.review.id, { reason: 'spam' })).rejects.toMatchObject({ status: 404 });
    await expect(mockApi.adminListReviews()).rejects.toMatchObject({ status: 403 });
  });

  it('avis reçus : réponse unique (409 ensuite), fiche d’autrui = 404', async () => {
    await loginAs('proprietaire1@example.test');
    const slug = 'sentinelle-securite-abidjan';
    const list = await mockApi.listOwnerReviews(slug, { status: 'approved' });
    const target = list.data.find((r) => !r.provider_reply);
    expect(target).toBeTruthy();
    await mockApi.replyToReview(slug, target!.id, 'Merci pour votre retour.');
    await expect(mockApi.replyToReview(slug, target!.id, 'Merci encore une fois.')).rejects.toMatchObject({ status: 409 });
    await expect(mockApi.listOwnerReviews('cerbere-brigade-canine')).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock vague B : Dis-moi tout, devis, contact', () => {
  beforeEach(async () => {
    await mockApi.logout();
  });

  it('feedback : idempotent, suivi avec réponses publiques seulement, 404 générique identique', async () => {
    const a = await mockApi.createFeedback(feedbackBody, 'cle-1');
    const b = await mockApi.createFeedback(feedbackBody, 'cle-1');
    expect(a.reference).toMatch(/^DMT-2026-\d{6}$/);
    expect(b.reference).toBe(a.reference);
    const demo = await mockApi.trackFeedback({ reference: 'dmt-2026-000101', email: 'AWA.demo@example.test' });
    expect(demo.replies).toHaveLength(1);
    expect(JSON.stringify(demo)).not.toMatch(/responsable du prestataire pour explication/);
    const e1 = await mockApi.trackFeedback({ reference: a.reference, email: 'autre@example.test' }).catch((e) => e);
    const e2 = await mockApi.trackFeedback({ reference: 'DMT-2026-999999', email: 'nouveau@example.test' }).catch((e) => e);
    expect(e1.status).toBe(404);
    expect(e1.message).toBe(e2.message);
  });

  it('feedback : règles conditionnelles et champ piège (rien enregistré)', async () => {
    await expect(mockApi.createFeedback({ ...feedbackBody, target_type: 'service' }, 'k')).rejects.toMatchObject({ status: 422 });
    await expect(mockApi.createFeedback({ ...feedbackBody, consent: false }, 'k2')).rejects.toMatchObject({ status: 422 });
    await expect(mockApi.createFeedback({ ...feedbackBody, email: 'limite@example.test' }, 'k3')).rejects.toMatchObject({ status: 429 });
    const trap = await mockApi.createFeedback({ ...feedbackBody, email: 'robot@example.test', company_website: 'http://spam' }, 'k4');
    expect(trap.reference).toMatch(/^DMT-/);
    await expect(mockApi.trackFeedback({ reference: trap.reference, email: 'robot@example.test' })).rejects.toMatchObject({ status: 404 });
  });

  it('admin feedbacks : statut, affectation, réponse interne vs envoyée, idempotence de la réponse', async () => {
    await loginAs('admin@example.test');
    const list = await mockApi.adminListFeedbacks({ status: 'new' });
    const row = list.data[0]!;
    const upd = await mockApi.adminUpdateFeedback(row.id, { status: 'resolved', assigned_to: 2 });
    expect(upd.resolved_at).not.toBeNull();
    expect(upd.assigned_to?.id).toBe(2);
    const r1 = await mockApi.adminReplyFeedback(row.id, { body: 'Merci pour votre retour.', is_internal: false }, 'rep-1');
    const r2 = await mockApi.adminReplyFeedback(row.id, { body: 'Merci pour votre retour.', is_internal: false }, 'rep-1');
    expect(r2.id).toBe(r1.id);
    expect(r1.sent_at).not.toBeNull();
    const note = await mockApi.adminReplyFeedback(row.id, { body: 'Note interne.', is_internal: true }, 'rep-2');
    expect(note.sent_at).toBeNull();
    const detail = await mockApi.adminGetFeedback(row.id);
    expect(detail.replies.length).toBeGreaterThanOrEqual(2);
  });

  it('devis : création avec/sans prestataires, acheminement idempotent, réponse unique', async () => {
    const body = {
      first_name: 'Awa', last_name: 'Koné', email: 'devis@example.test', phone: '+2250700000000',
      service_type_id: 2, city_id: 1, description: 'Gardiennage de nuit pour un entrepôt de stockage.', consent: true,
    };
    const direct = await mockApi.createQuoteRequest({ ...body, provider_slugs: ['sentinelle-securite-abidjan'] }, 'q1');
    const again = await mockApi.createQuoteRequest({ ...body, provider_slugs: ['sentinelle-securite-abidjan'] }, 'q1');
    expect(again.reference).toBe(direct.reference);
    await expect(
      mockApi.createQuoteRequest({ ...body, provider_slugs: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'q2'),
    ).rejects.toMatchObject({ status: 422 });
    const open = await mockApi.createQuoteRequest(body, 'q3');

    await loginAs('admin@example.test');
    const found = await mockApi.adminListQuotes({ q: open.reference });
    const id = found.data[0]!.id;
    expect(found.data[0]!.status).toBe('new');
    const d1 = await mockApi.adminDispatchQuote(id, [1, 2]);
    const d2 = await mockApi.adminDispatchQuote(id, [1, 2]);
    expect(d1.recipients).toHaveLength(2);
    expect(d2.recipients).toHaveLength(2);
    expect(d2.status).toBe('sent');
    await expect(mockApi.adminDispatchQuote(id, [])).rejects.toMatchObject({ status: 422 });

    await mockApi.logout();
    await loginAs('proprietaire1@example.test');
    const mine = await mockApi.listMyQuotes({ status: 'sent' });
    const quote = mine.data.find((q) => q.id === id)!;
    const opened = await mockApi.getMyQuote(quote.id);
    expect(opened.status).toBe('viewed');
    await mockApi.replyToQuote(quote.id, { message: 'Voici notre proposition détaillée.', quoted_amount: 450000 });
    await expect(mockApi.replyToQuote(quote.id, { message: 'Seconde réponse impossible.' })).rejects.toMatchObject({ status: 409 });
    await mockApi.logout();
    await loginAs('proprietaire3@example.test');
    await expect(mockApi.getMyQuote(quote.id)).rejects.toMatchObject({ status: 404 });
  });

  it('devis reçus : 403 pour un utilisateur sans fiche', async () => {
    await loginAs('simple@example.test');
    await expect(mockApi.listMyQuotes()).rejects.toMatchObject({ status: 403 });
  });

  it('contact : idempotent, piège silencieux, admin liste/répond', async () => {
    const msg = { name: 'Awa', email: 'contact@example.test', subject: 'Bonjour', message: 'Un message correct.', consent: true };
    await mockApi.sendContact(msg, 'c1');
    await mockApi.sendContact(msg, 'c1');
    await mockApi.sendContact({ ...msg, subject: 'Robot', company_website: 'x' }, 'c2');
    await loginAs('admin@example.test');
    const list = await mockApi.adminListContactMessages({ status: 'new', q: 'Bonjour' });
    expect(list.data).toHaveLength(1);
    expect((await mockApi.adminListContactMessages({ q: 'Robot' })).data).toHaveLength(0);
    await mockApi.adminReplyContactMessage(list.data[0]!.id, 'Merci pour votre message.');
    expect((await mockApi.adminListContactMessages({ status: 'answered', q: 'Bonjour' })).data).toHaveLength(1);
  });

  it('tableau de bord : compteurs vague B', async () => {
    await loginAs('admin@example.test');
    const d = await mockApi.adminDashboard();
    expect(d.pending_reviews).toBeGreaterThan(0);
    expect(d.open_review_reports).toBeGreaterThan(0);
    expect(d.new_feedbacks).toBeGreaterThan(0);
    expect(d.new_quote_requests).toBeGreaterThan(0);
    expect(d.new_contact_messages).toBeGreaterThan(0);
    expect(d.pending_providers).toBeGreaterThanOrEqual(0);
  });
});
