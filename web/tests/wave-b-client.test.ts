import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { buildApi } from '@/lib/api/endpoints';
import { createRequester } from '@/lib/api/http';

function res(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const xsrf = { value: 'tok' as string | null };
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('plus de réponse');
    return next;
  }) as unknown as typeof fetch;
  const req = createRequester({ baseUrl: 'http://api.test', fetchImpl, readXsrfCookie: () => xsrf.value });
  return { api: buildApi(req), calls };
}

const base = 'http://api.test/api/v1';
const headersOf = (c: { init: RequestInit }) => c.init.headers as Record<string, string>;
const bodyOf = (c: { init: RequestInit }) => JSON.parse(String(c.init.body));

describe('client API vague B', () => {
  it('createFeedback : POST /feedbacks avec Idempotency-Key et champ piège', async () => {
    const { api, calls } = setup([res(201, { data: { reference: 'DMT-2026-000123', status: 'new', message: 'ok' } })]);
    const r = await api.createFeedback(
      {
        last_name: 'Koné', first_name: 'Awa', email: 'a@b.co', action_type: 'question',
        target_type: 'product', comment: 'Une question assez longue.', consent: true, company_website: '',
      },
      'key-1',
    );
    expect(r.reference).toBe('DMT-2026-000123');
    expect(calls[0]!.url).toBe(`${base}/feedbacks`);
    expect(headersOf(calls[0]!)['Idempotency-Key']).toBe('key-1');
    expect(bodyOf(calls[0]!).company_website).toBe('');
  });

  it('trackFeedback : POST, référence et e-mail jamais dans l’URL ; 404 générique', async () => {
    const { api, calls } = setup([
      res(200, { data: { reference: 'DMT-2026-000101', status: 'new', created_at: 'x', provider_name: null, replies: [] } }),
      res(404, { message: 'Aucun dossier ne correspond à ces informations.' }),
    ]);
    await api.trackFeedback({ reference: 'DMT-2026-000101', email: 'a@b.co' });
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${base}/feedbacks/track`);
    expect(calls[0]!.url).not.toMatch(/DMT|a@b/);
    await expect(api.trackFeedback({ reference: 'X', email: 'a@b.co' })).rejects.toMatchObject({
      status: 404,
      message: 'Aucun dossier ne correspond à ces informations.',
    });
  });

  it('avis : création, 409, signalement, réponse propriétaire', async () => {
    const { api, calls } = setup([
      res(201, { data: { id: 1, status: 'pending' } }),
      res(409, { message: 'Vous avez déjà donné un avis pour ce prestataire.' }),
      res(204),
      res(200, {}),
    ]);
    await api.createReview('mon-slug', { rating: 5, body: 'Un excellent service.' });
    expect(calls[0]!.url).toBe(`${base}/providers/mon-slug/reviews`);
    const err = await api.createReview('mon-slug', { rating: 5, body: 'Un excellent service.' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isConflict).toBe(true);
    await api.reportReview(4, { reason: 'spam', details: 'x' });
    expect(calls[2]!.url).toBe(`${base}/reviews/4/report`);
    await api.replyToReview('mon-slug', 4, 'Merci pour votre retour.');
    expect(calls[3]!.url).toBe(`${base}/me/establishments/provider/mon-slug/reviews/4/reply`);
    expect(bodyOf(calls[3]!)).toEqual({ body: 'Merci pour votre retour.' });
  });

  it('listes : paramètres de requête et chemins admin', async () => {
    const page = { data: [], meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 }, links: { next: null, prev: null } };
    const { api, calls } = setup([res(200, page), res(200, page), res(200, page), res(200, page), res(200, page)]);
    await api.adminListReviews({ status: 'approved', provider: 'p', q: 'x', page: 2 });
    await api.adminListReviewReports({ status: 'open' });
    await api.adminListFeedbacks({ status: 'new', action_type: 'complaint', q: 'DMT', sort: '-created_at' });
    await api.adminListQuotes({ status: 'sent' });
    await api.adminListContactMessages({ status: 'read', q: 'a' });
    expect(calls[0]!.url).toBe(`${base}/admin/reviews?status=approved&provider=p&q=x&page=2`);
    expect(calls[1]!.url).toBe(`${base}/admin/review-reports?status=open`);
    expect(calls[2]!.url).toBe(`${base}/admin/feedbacks?status=new&action_type=complaint&q=DMT&sort=-created_at`);
    expect(calls[3]!.url).toBe(`${base}/admin/quote-requests?status=sent`);
    expect(calls[4]!.url).toBe(`${base}/admin/contact-messages?status=read&q=a`);
  });

  it('actions admin : chemins et corps', async () => {
    const { api, calls } = setup([res(200, {}), res(200, {}), res(204), res(200, {}), res(200, { data: {} }), res(200, {}), res(200, {})]);
    await api.adminReviewAction(3, 'reject', 'Motif suffisamment long.');
    await api.adminReviewAction(3, 'approve');
    await api.adminDeleteReview(3);
    await api.adminReviewReportAction(8, 'accept');
    await api.adminDispatchQuote(5, [1, 2]);
    await api.adminUpdateQuoteStatus(5, 'closed');
    await api.adminReplyContactMessage(9, 'Merci pour votre message.');
    expect(calls[0]!.url).toBe(`${base}/admin/reviews/3/reject`);
    expect(bodyOf(calls[0]!)).toEqual({ reason: 'Motif suffisamment long.' });
    expect(calls[1]!.init.body).toBeUndefined();
    expect(calls[2]!.init.method).toBe('DELETE');
    expect(calls[3]!.url).toBe(`${base}/admin/review-reports/8/accept`);
    expect(bodyOf(calls[4]!)).toEqual({ provider_ids: [1, 2] });
    expect(bodyOf(calls[5]!)).toEqual({ status: 'closed' });
    expect(bodyOf(calls[6]!)).toEqual({ body: 'Merci pour votre message.' });
  });

  it('devis et contact : Idempotency-Key, 429 avec Retry-After', async () => {
    const { api, calls } = setup([
      res(201, { data: { reference: 'DEV-2026-000123', message: 'ok' } }),
      res(429, { message: 'x' }, { 'Retry-After': '120' }),
    ]);
    await api.createQuoteRequest(
      {
        first_name: 'A', last_name: 'B', email: 'a@b.co', phone: '+2250700000000', service_type_id: 1, city_id: 1,
        description: 'Une description suffisamment longue.', consent: true, provider_slugs: ['p'],
      },
      'k2',
    );
    expect(calls[0]!.url).toBe(`${base}/quote-requests`);
    expect(headersOf(calls[0]!)['Idempotency-Key']).toBe('k2');
    const err = await api
      .sendContact({ name: 'A', email: 'a@b.co', subject: 's', message: 'Un message correct.', consent: true }, 'k3')
      .catch((e) => e);
    expect(err.isRateLimited).toBe(true);
    expect(err.retryAfter).toBe(120);
  });

  it('inscription et mot de passe oublié : le jeton Turnstile est transmis', async () => {
    const { api, calls } = setup([res(204), res(202, { message: 'ok' })]);
    await api.forgotPassword('a@b.co', { turnstile_token: 'tok-1' });
    await api.resendVerificationPublic('a@b.co', { turnstile_token: 'tok-2' });
    expect(bodyOf(calls[0]!)).toEqual({ email: 'a@b.co', turnstile_token: 'tok-1' });
    expect(bodyOf(calls[1]!)).toEqual({ email: 'a@b.co', turnstile_token: 'tok-2' });
  });
});
