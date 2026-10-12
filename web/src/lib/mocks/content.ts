import { ApiError } from '../api/errors';
import type { ContentApi } from '../api/content-endpoints';
import { NEWSLETTER_NEUTRAL_MESSAGE } from '../api/content-endpoints';
import type {
  AdminSetting,
  BlogComment,
  CommentStatus,
  ContentCategory,
  ContentComment,
  ContentPage,
  ContentPartner,
  ContentPost,
  NewsletterSubscriber,
  PostCard,
} from '../api/types';
import type { MockContext } from './establishments';
import {
  categorySeed,
  NOW_ISO,
  pageSeed,
  partnerSeed,
  postSeeds,
  settingsSeed,
} from './content-data';

/**
 * Implémentation locale (mode mock) de l'API de contenu — phase 4. Données en mémoire, fictives.
 * Rôles : e-mail commençant par « admin » => admin ; « editor » => editor (voir mock-api.ts).
 * Jetons newsletter de démonstration : `invalide` => lien invalide ; tout autre => accepté.
 */

const notFound = () => new ApiError(404, 'Cette page ou cette ressource est introuvable.');
const forbidden = () => new ApiError(403, "Vous n'avez pas l'autorisation d'effectuer cette action.");
const invalid = (field: string, message: string) =>
  new ApiError(422, 'Certaines informations sont invalides.', { [field]: [message] });

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toBody(paras: string[]): string {
  return paras
    .map((t) => (t.startsWith('## ') ? `<h2>${escapeHtml(t.slice(3))}</h2>` : `<p>${escapeHtml(t)}</p>`))
    .join('');
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const readingMinutes = (html: string) => Math.max(1, Math.round(stripTags(html).split(' ').length / 200));
const daysFrom = (days: number) => new Date(Date.parse(NOW_ISO) - days * 86_400_000).toISOString();

interface PostRec {
  id: number;
  slug: string;
  title: string;
  categoryId: number;
  excerpt: string | null;
  body: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  published_at: string | null;
  is_featured: boolean;
  is_flash: boolean;
  views: number;
  author: string;
  seo_title: string | null;
  seo_description: string | null;
  cover: { id: number; url: string; alt: string | null } | null;
  updated_at: string;
  deleted: boolean;
}

interface CommentRec {
  id: number;
  postId: number;
  parentId: number | null;
  author: string;
  body: string;
  status: CommentStatus;
  created_at: string;
}

export interface ContentDashboardCounts {
  pending_comments: number;
  confirmed_subscribers: number;
}

export function createContentMocks(
  ctx: MockContext,
): ContentApi & { dashboardCounts(): ContentDashboardCounts } {
  let seq = 9000;
  const next = () => ++seq;

  const categories: (ContentCategory & { posts_count?: number })[] = categorySeed.map((c, i) => ({
    id: i + 1,
    slug: c.slug,
    name: c.name,
    description: c.description,
    sort_order: i + 1,
    is_visible: true,
    posts_count: 0,
  }));
  const catById = (id: number) => categories.find((c) => c.id === id);

  const posts: PostRec[] = postSeeds.map((s, i) => {
    const body = toBody(s.paras);
    return {
      id: i + 1,
      slug: slugify(s.title),
      title: s.title,
      categoryId: categories.find((c) => c.slug === s.cat)!.id,
      excerpt: s.excerpt,
      body,
      status: s.status,
      published_at: s.status === 'draft' ? null : daysFrom(s.daysAgo),
      is_featured: s.featured ?? false,
      is_flash: s.flash ?? false,
      views: s.views,
      author: s.author ?? 'Rédaction ProtectIci',
      seo_title: null,
      seo_description: null,
      cover: null,
      updated_at: daysFrom(Math.max(s.daysAgo - 1, 0)),
      deleted: false,
    };
  });

  const comments: CommentRec[] = [
    { id: 1, postId: 1, parentId: null, author: 'Kouassi A.', body: 'Merci pour ces conseils, très utiles avant de signer mon contrat.', status: 'approved', created_at: daysFrom(1) },
    { id: 2, postId: 1, parentId: 1, author: 'Rédaction ProtectIci', body: 'Avec plaisir. N’hésitez pas à consulter les avis sur les fiches de l’annuaire.', status: 'approved', created_at: daysFrom(1) },
    { id: 3, postId: 3, parentId: null, author: 'Fatou D.', body: 'J’ai reçu ce type de message hier, je l’ai signalé à mon opérateur.', status: 'approved', created_at: daysFrom(2) },
    { id: 4, postId: 3, parentId: null, author: 'Yao B.', body: 'Est-ce que le signalement est gratuit auprès des autorités ?', status: 'pending', created_at: daysFrom(0.2) },
    { id: 5, postId: 2, parentId: null, author: 'Aminata S.', body: 'Pensez à organiser un exercice d’évacuation dans votre immeuble.', status: 'pending', created_at: daysFrom(0.1) },
  ];

  const partners: ContentPartner[] = partnerSeed.map((p, i) => ({
    id: i + 1,
    type: p.type,
    name: p.name,
    website_url: p.website_url,
    description: p.description,
    sort_order: i + 1,
    is_visible: true,
    logo_media_id: null,
    logo_url: null,
  }));

  const pages: ContentPage[] = Object.entries(pageSeed).map(([slug, p]) => ({
    slug,
    title: p.title,
    body: p.body,
    seo_title: null,
    seo_description: p.seo_description,
    is_visible: true,
    updated_at: NOW_ISO,
  }));

  const settings: AdminSetting[] = settingsSeed.map((s) => ({ ...s }));

  const subscribers: NewsletterSubscriber[] = [
    { id: 1, email: 'lecteur1@exemple.test', status: 'confirmed', source: 'footer', created_at: daysFrom(20), confirmed_at: daysFrom(20), unsubscribed_at: null },
    { id: 2, email: 'lecteur2@exemple.test', status: 'confirmed', source: 'footer', created_at: daysFrom(12), confirmed_at: daysFrom(12), unsubscribed_at: null },
    { id: 3, email: 'lecteur3@exemple.test', status: 'pending', source: 'footer', created_at: daysFrom(1), confirmed_at: null, unsubscribed_at: null },
    { id: 4, email: 'lecteur4@exemple.test', status: 'unsubscribed', source: 'blog', created_at: daysFrom(60), confirmed_at: daysFrom(60), unsubscribed_at: daysFrom(5) },
  ];

  /* ---------- Aides ---------- */
  const isLive = (p: PostRec) =>
    !p.deleted &&
    p.status === 'published' &&
    p.published_at !== null &&
    Date.parse(p.published_at) <= Date.parse(NOW_ISO);

  function toCard(p: PostRec): PostCard {
    const cat = catById(p.categoryId)!;
    return {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? stripTags(p.body).slice(0, 160),
      category: { slug: cat.slug, name: cat.name },
      cover_url: p.cover?.url ?? null,
      cover_alt: p.cover?.alt ?? null,
      published_at: p.published_at ?? NOW_ISO,
      reading_minutes: readingMinutes(p.body),
      views_count: p.views,
      is_featured: p.is_featured,
      author_name: p.author,
    };
  }

  function toRow(p: PostRec) {
    const cat = catById(p.categoryId)!;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      category: { id: cat.id, slug: cat.slug, name: cat.name },
      published_at: p.published_at,
      is_featured: p.is_featured,
      is_flash: p.is_flash,
      views_count: p.views,
      author_name: p.author,
      updated_at: p.updated_at,
    };
  }

  function toFull(p: PostRec): ContentPost {
    return {
      ...toRow(p),
      excerpt: p.excerpt,
      body: p.body,
      seo_title: p.seo_title,
      seo_description: p.seo_description,
      cover: p.cover,
    };
  }

  const requireContent = () => {
    const s = ctx.requireSession();
    if (s.role !== 'editor' && s.role !== 'admin') throw forbidden();
    return s;
  };
  const requireAdmin = () => {
    const s = ctx.requireSession();
    if (s.role !== 'admin') throw forbidden();
    return s;
  };

  function between(field: string, v: string | undefined | null, min: number, max: number, label: string) {
    const t = (v ?? '').trim();
    if (t.length < min) throw invalid(field, `${label} doit comporter au moins ${min} caractères.`);
    if (t.length > max) throw invalid(field, `${label} ne doit pas dépasser ${max} caractères.`);
  }

  function visibleComments(postId: number): BlogComment[] {
    const ok = comments.filter((c) => c.postId === postId && c.status === 'approved');
    const roots = ok.filter((c) => c.parentId === null);
    const map = (c: CommentRec): BlogComment => ({
      id: c.id,
      author_name: c.author,
      body: c.body,
      created_at: c.created_at,
      replies: ok.filter((r) => r.parentId === c.id).map(map),
    });
    return roots.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(map);
  }

  function applyPostInput(p: PostRec, input: Partial<Parameters<ContentApi['contentCreatePost']>[0]>) {
    if (input.title !== undefined) {
      between('title', input.title, 3, 160, 'Le titre');
      p.title = input.title.trim();
    }
    if (input.category_id !== undefined) {
      if (!catById(input.category_id)) throw invalid('category_id', 'Cette catégorie est introuvable.');
      p.categoryId = input.category_id;
    }
    if (input.excerpt !== undefined) p.excerpt = input.excerpt?.trim() || null;
    if (input.body !== undefined) {
      between('body', stripTags(input.body), 10, 100000, 'Le contenu');
      p.body = input.body;
    }
    if (input.status !== undefined) {
      if (!['draft', 'scheduled', 'published', 'archived'].includes(input.status))
        throw invalid('status', 'Statut inconnu.');
      p.status = input.status;
    }
    if (input.published_at !== undefined) p.published_at = input.published_at;
    if (p.status === 'scheduled' && !p.published_at)
      throw invalid('published_at', 'La date de publication est obligatoire pour une planification.');
    if (p.status === 'published' && !p.published_at) p.published_at = NOW_ISO;
    if (input.is_featured !== undefined) p.is_featured = input.is_featured;
    if (input.is_flash !== undefined) p.is_flash = input.is_flash;
    if (input.seo_title !== undefined) p.seo_title = input.seo_title?.trim() || null;
    if (input.seo_description !== undefined) p.seo_description = input.seo_description?.trim() || null;
    if (input.cover_media_id === null) p.cover = null;
    p.updated_at = new Date().toISOString();
  }

  return {
    dashboardCounts() {
      return {
        pending_comments: comments.filter((c) => c.status === 'pending').length,
        confirmed_subscribers: subscribers.filter((s) => s.status === 'confirmed').length,
      };
    },

    /* ----- Public ----- */
    async listBlogCategories() {
      await ctx.delay();
      return categories
        .filter((c) => c.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          description: c.description,
          posts_count: posts.filter((p) => isLive(p) && p.categoryId === c.id).length,
        }));
    },
    async listPosts(query = {}) {
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      let list = posts.filter(isLive);
      if (query.category) list = list.filter((p) => catById(p.categoryId)?.slug === query.category);
      if (query.featured) list = list.filter((p) => p.is_featured);
      if (q)
        list = list.filter((p) => `${p.title} ${p.excerpt ?? ''} ${stripTags(p.body)}`.toLowerCase().includes(q));
      list = [...list].sort((a, b) =>
        query.sort === 'popular'
          ? b.views - a.views
          : (b.published_at ?? '').localeCompare(a.published_at ?? ''),
      );
      return ctx.paginate(list.map(toCard), query.page, Math.min(query.per_page ?? 12, 24));
    },
    async getPost(slug) {
      await ctx.delay();
      const p = posts.find((x) => x.slug === slug);
      if (!p || !isLive(p)) throw notFound();
      p.views += 1;
      const related = posts
        .filter((x) => isLive(x) && x.id !== p.id && x.categoryId === p.categoryId)
        .slice(0, 3)
        .map(toCard);
      return {
        ...toCard(p),
        body: p.body,
        seo_title: p.seo_title,
        seo_description: p.seo_description,
        related,
      };
    },
    async listPostComments(slug, page) {
      await ctx.delay();
      const p = posts.find((x) => x.slug === slug);
      if (!p || !isLive(p)) throw notFound();
      return ctx.paginate(visibleComments(p.id), page, 10);
    },
    async createPostComment(slug, input) {
      const s = ctx.requireSession();
      await ctx.delay();
      const p = posts.find((x) => x.slug === slug);
      if (!p || !isLive(p)) throw notFound();
      if (!s.verified)
        throw new ApiError(403, 'Veuillez vérifier votre adresse e-mail pour commenter.');
      if (input.company_website) return; // champ piège : succès simulé, rien d'enregistré
      between('body', input.body, 2, 2000, 'Le commentaire');
      comments.push({
        id: next(),
        postId: p.id,
        parentId: input.parent_id ?? null,
        author: `${s.first_name} ${s.last_name.charAt(0)}.`,
        body: input.body.trim(),
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    },
    async getFlash() {
      await ctx.delay();
      return posts
        .filter((p) => isLive(p) && p.is_flash)
        .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
        .slice(0, 10)
        .map((p) => ({ slug: p.slug, title: p.title, published_at: p.published_at ?? NOW_ISO }));
    },
    async getPage(slug) {
      await ctx.delay();
      const pg = pages.find((x) => x.slug === slug && x.is_visible);
      if (!pg) throw notFound();
      return {
        slug: pg.slug,
        title: pg.title,
        body: pg.body,
        seo_title: pg.seo_title,
        seo_description: pg.seo_description,
        updated_at: pg.updated_at,
      };
    },
    async listPartners(type) {
      await ctx.delay();
      return partners
        .filter((p) => p.is_visible && (!type || p.type === type))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          id: p.id,
          type: p.type,
          name: p.name,
          website_url: p.website_url,
          description: p.description,
          logo_url: p.logo_url,
        }));
    },
    async getPublicSettings() {
      await ctx.delay();
      return Object.fromEntries(settings.filter((s) => s.is_public).map((s) => [s.key, s.value]));
    },
    async subscribeNewsletter(input) {
      await ctx.delay();
      if (input.company_website) return NEWSLETTER_NEUTRAL_MESSAGE;
      if (!input.consent) throw invalid('consent', 'Votre accord est nécessaire pour vous abonner.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        throw invalid('email', "L'adresse e-mail n'est pas valide.");
      const email = input.email.trim().toLowerCase();
      if (!subscribers.some((s) => s.email === email)) {
        subscribers.push({
          id: next(),
          email,
          status: 'pending',
          source: input.source ?? null,
          created_at: new Date().toISOString(),
          confirmed_at: null,
          unsubscribed_at: null,
        });
      }
      return NEWSLETTER_NEUTRAL_MESSAGE;
    },
    async confirmNewsletter(token) {
      await ctx.delay();
      if (!token || token === 'invalide')
        throw new ApiError(422, 'Ce lien est invalide ou a expiré.');
    },
    async unsubscribeNewsletter(token) {
      await ctx.delay();
      if (!token || token === 'invalide')
        throw new ApiError(422, 'Ce lien est invalide ou a expiré.');
    },

    /* ----- Back-office contenu ----- */
    async contentListPosts(query = {}) {
      requireContent();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const list = posts
        .filter((p) => !p.deleted)
        .filter((p) => !query.status || p.status === query.status)
        .filter((p) => !query.category || catById(p.categoryId)?.slug === query.category)
        .filter((p) => !q || p.title.toLowerCase().includes(q))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(toRow);
      return ctx.paginate(list, query.page, 20);
    },
    async contentGetPost(id) {
      requireContent();
      await ctx.delay();
      const p = posts.find((x) => x.id === id && !x.deleted);
      if (!p) throw notFound();
      return toFull(p);
    },
    async contentCreatePost(input) {
      const s = requireContent();
      await ctx.delay();
      const rec: PostRec = {
        id: next(),
        slug: '',
        title: '',
        categoryId: input.category_id,
        excerpt: null,
        body: '',
        status: 'draft',
        published_at: null,
        is_featured: false,
        is_flash: false,
        views: 0,
        author: `${s.first_name} ${s.last_name}`.trim(),
        seo_title: null,
        seo_description: null,
        cover: null,
        updated_at: NOW_ISO,
        deleted: false,
      };
      applyPostInput(rec, input);
      let slug = slugify(rec.title) || `article-${rec.id}`;
      while (posts.some((p) => p.slug === slug)) slug += '-2';
      rec.slug = slug;
      posts.push(rec);
      return toFull(rec);
    },
    async contentUpdatePost(id, input) {
      requireContent();
      await ctx.delay();
      const p = posts.find((x) => x.id === id && !x.deleted);
      if (!p) throw notFound();
      applyPostInput(p, input);
      return toFull(p);
    },
    async contentDeletePost(id) {
      requireContent();
      await ctx.delay();
      const p = posts.find((x) => x.id === id && !x.deleted);
      if (!p) throw notFound();
      p.deleted = true;
    },
    async contentUploadMedia(file, alt) {
      requireContent();
      await ctx.delay();
      if (!file.type.startsWith('image/')) throw invalid('file', 'Ce type de fichier n’est pas accepté.');
      return { id: next(), url: '/logo-protectici.webp', alt: alt || null };
    },
    async contentListComments(query = {}) {
      requireContent();
      await ctx.delay();
      const status = query.status ?? 'pending';
      const list: ContentComment[] = comments
        .filter((c) => c.status === status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => {
          const p = posts.find((x) => x.id === c.postId)!;
          return {
            id: c.id,
            post: { id: p.id, slug: p.slug, title: p.title },
            author_name: c.author,
            body: c.body,
            status: c.status,
            parent_id: c.parentId,
            created_at: c.created_at,
          };
        });
      return ctx.paginate(list, query.page, 20);
    },
    async contentModerateComment(id, status) {
      requireContent();
      await ctx.delay();
      const c = comments.find((x) => x.id === id);
      if (!c) throw notFound();
      if (!['approved', 'rejected', 'spam'].includes(status)) throw invalid('status', 'Statut inconnu.');
      c.status = status;
    },
    async contentListCategories() {
      requireContent();
      await ctx.delay();
      return categories
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          ...c,
          posts_count: posts.filter((p) => !p.deleted && p.categoryId === c.id).length,
        }));
    },
    async contentUpdateCategory(id, input) {
      requireContent();
      await ctx.delay();
      const c = catById(id);
      if (!c) throw notFound();
      between('name', input.name, 2, 80, 'Le nom');
      c.name = input.name.trim();
      c.description = input.description?.trim() || null;
      c.sort_order = input.sort_order;
      c.is_visible = input.is_visible;
      return { ...c, posts_count: posts.filter((p) => !p.deleted && p.categoryId === c.id).length };
    },
    async contentGetPage(slug) {
      requireContent();
      await ctx.delay();
      const pg = pages.find((x) => x.slug === slug);
      if (!pg) throw notFound();
      return { ...pg };
    },
    async contentUpdatePage(slug, input) {
      const s = requireContent();
      if (s.role !== 'admin') throw forbidden(); // pages légales : admin uniquement
      await ctx.delay();
      const pg = pages.find((x) => x.slug === slug);
      if (!pg) throw notFound();
      between('title', input.title, 3, 160, 'Le titre');
      between('body', stripTags(input.body), 10, 100000, 'Le contenu');
      Object.assign(pg, input, { updated_at: new Date().toISOString() });
      return { ...pg };
    },
    async contentListPartners(type) {
      requireAdmin();
      await ctx.delay();
      return partners.filter((p) => !type || p.type === type).sort((a, b) => a.sort_order - b.sort_order);
    },
    async contentCreatePartner(input) {
      requireAdmin();
      await ctx.delay();
      between('name', input.name, 2, 120, 'Le nom');
      const rec: ContentPartner = {
        id: next(),
        type: input.type,
        name: input.name.trim(),
        website_url: input.website_url,
        description: input.description,
        sort_order: input.sort_order,
        is_visible: input.is_visible,
        logo_media_id: input.logo_media_id ?? null,
        logo_url: input.logo_media_id ? '/logo-protectici.webp' : null,
      };
      partners.push(rec);
      return rec;
    },
    async contentUpdatePartner(id, input) {
      requireAdmin();
      await ctx.delay();
      const p = partners.find((x) => x.id === id);
      if (!p) throw notFound();
      between('name', input.name, 2, 120, 'Le nom');
      Object.assign(p, input, { name: input.name.trim() });
      if (input.logo_media_id) p.logo_url = '/logo-protectici.webp';
      return { ...p };
    },
    async contentDeletePartner(id) {
      requireAdmin();
      await ctx.delay();
      const i = partners.findIndex((x) => x.id === id);
      if (i < 0) throw notFound();
      partners.splice(i, 1);
    },
    async adminGetSettings() {
      requireAdmin();
      await ctx.delay();
      return settings.map((s) => ({ ...s }));
    },
    async adminUpdateSettings(list) {
      requireAdmin();
      await ctx.delay();
      for (const item of list) {
        const cur = settings.find((s) => s.key === item.key);
        if (!cur) throw invalid('settings', `La clé « ${item.key} » n’est pas autorisée.`);
        cur.value = item.value;
        cur.is_public = item.is_public;
      }
      return settings.map((s) => ({ ...s }));
    },
    async adminListSubscribers(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const list = subscribers
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !q || s.email.includes(q))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ctx.paginate(list, query.page, 20);
    },
  };
}
