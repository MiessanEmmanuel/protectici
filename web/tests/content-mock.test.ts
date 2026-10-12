import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '@/lib/api/endpoints';
import { postFormSchema, localInputToIso, isoToLocalInput, newsletterSchema } from '@/lib/content-schemas';
import { parseBlogParams } from '@/lib/blog-params';
import { validate } from '@/lib/validation';

let api: Api;
beforeAll(async () => {
  api = (await import('@/lib/mocks/mock-api')).mockApi;
});
async function loginAs(email: string) {
  const r = await api.login({ email, password: 'motdepasse' });
  if (r.kind === 'two_factor') await api.twoFactorChallenge({ code: '123456' });
}

describe('mock contenu : public', () => {
  beforeEach(async () => {
    await api.logout();
  });
  it('7 catégories en français, articles publiés seulement, pagination', async () => {
    const cats = await api.listBlogCategories();
    expect(cats.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Actualités', 'Anti-intrusion', 'Cybercriminalité', 'Domotique', 'Emploi', 'Formation', 'Sécurité incendie']),
    );
    expect(cats).toHaveLength(7);
    const page = await api.listPosts({ per_page: 5 });
    expect(page.data.length).toBeLessThanOrEqual(5);
    expect(page.meta.last_page).toBeGreaterThan(1);
    expect(page.meta.total).toBeGreaterThanOrEqual(12);
  });
  it('filtre par catégorie, recherche, à la une, populaires', async () => {
    const inc = await api.listPosts({ category: 'securite-incendie' });
    expect(inc.data.length).toBeGreaterThan(0);
    expect(inc.data.every((p) => p.category.slug === 'securite-incendie')).toBe(true);
    const featured = await api.listPosts({ featured: true });
    expect(featured.data.every((p) => p.is_featured)).toBe(true);
    const popular = await api.listPosts({ sort: 'popular', per_page: 5 });
    const views = popular.data.map((p) => p.views_count);
    expect([...views].sort((a, b) => b - a)).toEqual(views);
    const none = await api.listPosts({ q: 'zzzzintrouvablezzzz' });
    expect(none.data).toHaveLength(0);
  });
  it('un article non publié est introuvable (404)', async () => {
    const list = await api.listPosts({ per_page: 24 });
    await expect(api.getPost('slug-inexistant')).rejects.toMatchObject({ status: 404 });
    const first = await api.getPost(list.data[0]!.slug);
    expect(first.related.length).toBeLessThanOrEqual(3);
    expect(first.body).not.toMatch(/<script|onerror=/i);
  });
  it('pages institutionnelles, partenaires, paramètres publics, flash', async () => {
    for (const slug of ['qui-sommes-nous', 'mentions-legales', 'confidentialite', 'cgu']) {
      expect((await api.getPage(slug)).body.length).toBeGreaterThan(50);
    }
    await expect(api.getPage('inconnue')).rejects.toMatchObject({ status: 404 });
    expect((await api.listPartners('client')).every((p) => p.type === 'client')).toBe(true);
    const settings = await api.getPublicSettings();
    expect(settings['contact.email']).toBeTruthy();
    expect(settings).not.toHaveProperty('contact.notification_email');
    expect((await api.getFlash()).length).toBeLessThanOrEqual(10);
  });
  it('newsletter : réponse neutre identique, jeton invalide = 422', async () => {
    const a = await api.subscribeNewsletter({ email: 'x1@example.test', consent: true });
    const b = await api.subscribeNewsletter({ email: 'x1@example.test', consent: true });
    expect(a).toBe(b);
    await expect(api.confirmNewsletter('invalide')).rejects.toMatchObject({ status: 422 });
    await expect(api.unsubscribeNewsletter('invalide')).rejects.toMatchObject({ status: 422 });
  });
  it('commentaire : connexion requise', async () => {
    const slug = (await api.listPosts({})).data[0]!.slug;
    await expect(api.createPostComment(slug, { body: 'Bonjour' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('mock contenu : back-office et rôles', () => {
  beforeEach(async () => {
    await api.logout();
  });
  it('anonyme et user : 401/403 sur /content', async () => {
    await expect(api.contentListPosts()).rejects.toMatchObject({ status: 401 });
    await loginAs('nouveau@example.test');
    await expect(api.contentListPosts()).rejects.toMatchObject({ status: 403 });
  });
  it('editor : blog oui, partenaires/paramètres/newsletter/pages en écriture non', async () => {
    await loginAs('editor@example.test');
    expect((await api.contentListPosts()).data.length).toBeGreaterThan(0);
    await expect(api.contentListPartners()).rejects.toMatchObject({ status: 403 });
    await expect(api.adminGetSettings()).rejects.toMatchObject({ status: 403 });
    await expect(api.adminListSubscribers()).rejects.toMatchObject({ status: 403 });
    const page = await api.contentGetPage('cgu');
    await expect(
      api.contentUpdatePage('cgu', { title: page.title, body: page.body, seo_title: null, seo_description: null, is_visible: true }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('création d’un brouillon, planification sans date refusée, publication visible, modération', async () => {
    await loginAs('editor@example.test');
    const cats = await api.contentListCategories();
    const base = { title: 'Test de rédaction', category_id: cats[0]!.id, body: '<p>Un contenu suffisamment long.</p>', is_featured: false, is_flash: false };
    const draft = await api.contentCreatePost({ ...base, status: 'draft' });
    expect(draft.status).toBe('draft');
    await expect(api.getPost(draft.slug)).rejects.toMatchObject({ status: 404 });
    await expect(api.contentCreatePost({ ...base, status: 'scheduled' })).rejects.toMatchObject({ status: 422 });
    await api.contentUpdatePost(draft.id, { status: 'published' });
    expect((await api.getPost(draft.slug)).title).toBe('Test de rédaction');
    const pending = await api.contentListComments({ status: 'pending' });
    if (pending.data[0]) {
      await api.contentModerateComment(pending.data[0].id, 'approved');
      const after = await api.contentListComments({ status: 'pending' });
      expect(after.data.find((c) => c.id === pending.data[0]!.id)).toBeUndefined();
    }
  });
  it('admin : compteurs du tableau de bord', async () => {
    await loginAs('admin@example.test');
    const d = await api.adminDashboard();
    expect(typeof d.pending_comments).toBe('number');
    expect(typeof d.confirmed_subscribers).toBe('number');
    expect((await api.adminGetSettings()).length).toBeGreaterThan(0);
  });
});

describe('schémas et paramètres', () => {
  it('postFormSchema : planification exige une date', () => {
    const base = { title: 'Un titre', category_id: '2', body: '<p>Contenu assez long</p>', is_featured: false, is_flash: false };
    expect(validate(postFormSchema, { ...base, status: 'scheduled', published_at: '' }).ok).toBe(false);
    expect(validate(postFormSchema, { ...base, status: 'draft' }).ok).toBe(true);
    expect(validate(postFormSchema, { ...base, status: 'inconnu' }).ok).toBe(false);
  });
  it('newsletterSchema exige le consentement', () => {
    expect(validate(newsletterSchema, { email: 'a@b.ci', consent: false }).ok).toBe(false);
    expect(validate(newsletterSchema, { email: 'a@b.ci', consent: true }).ok).toBe(true);
  });
  it('dates datetime-local <-> ISO', () => {
    const iso = localInputToIso('2026-10-20T14:30');
    expect(iso).toBe('2026-10-20T14:30:00Z');
    expect(isoToLocalInput(iso)).toBe('2026-10-20T14:30');
    expect(localInputToIso('')).toBeNull();
  });
  it('parseBlogParams borne les entrées', () => {
    expect(parseBlogParams({ page: '-3', q: 'a'.repeat(300) }).page).toBe(1);
    expect(parseBlogParams({ q: 'a'.repeat(300) }).q).toHaveLength(100);
    expect(parseBlogParams({ page: '4' }).page).toBe(4);
  });
});
