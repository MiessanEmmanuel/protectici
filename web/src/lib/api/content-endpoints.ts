import type { Requester } from './http';
import type {
  AdminSetting,
  AntiSpamPayload,
  BlogComment,
  CommentStatus,
  ContentCategory,
  ContentCategoryInput,
  ContentComment,
  ContentPage,
  ContentPageInput,
  ContentPartner,
  ContentPartnerInput,
  ContentPost,
  ContentPostInput,
  ContentPostQuery,
  ContentPostRow,
  FlashItem,
  MediaUpload,
  NewsletterStatus,
  NewsletterSubscribeInput,
  NewsletterSubscriber,
  Paginated,
  Partner,
  PartnerType,
  Post,
  PostCard,
  PostCategory,
  PostQuery,
  PublicSettings,
  SitePage,
} from './types';

/** Message neutre affiché après une demande d'abonnement (réponse toujours identique, contrat §9.1). */
export const NEWSLETTER_NEUTRAL_MESSAGE =
  'Merci. Si cette adresse est valide, un e-mail de confirmation vient de vous être envoyé. Cliquez sur le lien qu’il contient pour finaliser votre abonnement.';

/** Phase 4 — contenu éditorial (contrat §9). */
export interface ContentApi {
  // --- Public (§9.1) ---
  listBlogCategories(): Promise<PostCategory[]>;
  listPosts(query?: PostQuery): Promise<Paginated<PostCard>>;
  getPost(slug: string): Promise<Post>;
  listPostComments(slug: string, page?: number): Promise<Paginated<BlogComment>>;
  createPostComment(
    slug: string,
    input: { body: string; parent_id?: number | null } & AntiSpamPayload,
  ): Promise<void>;
  getFlash(): Promise<FlashItem[]>;
  getPage(slug: string): Promise<SitePage>;
  listPartners(type?: PartnerType): Promise<Partner[]>;
  getPublicSettings(): Promise<PublicSettings>;
  subscribeNewsletter(input: NewsletterSubscribeInput): Promise<string>;
  confirmNewsletter(token: string): Promise<void>;
  unsubscribeNewsletter(token: string): Promise<void>;
  // --- Back-office contenu (§9.2, editor ou admin) ---
  contentListPosts(query?: ContentPostQuery): Promise<Paginated<ContentPostRow>>;
  contentGetPost(id: number): Promise<ContentPost>;
  contentCreatePost(input: ContentPostInput): Promise<ContentPost>;
  contentUpdatePost(id: number, input: Partial<ContentPostInput>): Promise<ContentPost>;
  contentDeletePost(id: number): Promise<void>;
  contentUploadMedia(file: File, alt: string): Promise<MediaUpload>;
  contentListComments(query?: { status?: CommentStatus; page?: number }): Promise<Paginated<ContentComment>>;
  contentModerateComment(id: number, status: Exclude<CommentStatus, 'pending'>): Promise<void>;
  contentListCategories(): Promise<ContentCategory[]>;
  contentUpdateCategory(id: number, input: ContentCategoryInput): Promise<ContentCategory>;
  contentGetPage(slug: string): Promise<ContentPage>;
  contentUpdatePage(slug: string, input: ContentPageInput): Promise<ContentPage>;
  contentListPartners(type?: PartnerType): Promise<ContentPartner[]>;
  contentCreatePartner(input: ContentPartnerInput): Promise<ContentPartner>;
  contentUpdatePartner(id: number, input: ContentPartnerInput): Promise<ContentPartner>;
  contentDeletePartner(id: number): Promise<void>;
  // --- Admin uniquement ---
  adminGetSettings(): Promise<AdminSetting[]>;
  adminUpdateSettings(settings: AdminSetting[]): Promise<AdminSetting[]>;
  adminListSubscribers(query?: {
    status?: NewsletterStatus;
    q?: string;
    page?: number;
  }): Promise<Paginated<NewsletterSubscriber>>;
}

export function buildContentApi(req: Requester): ContentApi {
  return {
    async listBlogCategories() {
      return (await req<{ data: PostCategory[] }>('GET', '/blog/categories')).data;
    },
    listPosts(query = {}) {
      return req<Paginated<PostCard>>('GET', '/blog/posts', {
        query: {
          category: query.category,
          q: query.q,
          featured: query.featured ? 1 : undefined,
          sort: query.sort,
          page: query.page,
          per_page: query.per_page,
        },
      });
    },
    async getPost(slug) {
      return (await req<{ data: Post }>('GET', `/blog/posts/${encodeURIComponent(slug)}`)).data;
    },
    listPostComments(slug, page) {
      return req<Paginated<BlogComment>>(
        'GET',
        `/blog/posts/${encodeURIComponent(slug)}/comments`,
        { query: { page } },
      );
    },
    async createPostComment(slug, input) {
      await req('POST', `/blog/posts/${encodeURIComponent(slug)}/comments`, { body: input });
    },
    async getFlash() {
      return (await req<{ data: FlashItem[] }>('GET', '/blog/flash')).data;
    },
    async getPage(slug) {
      return (await req<{ data: SitePage }>('GET', `/pages/${encodeURIComponent(slug)}`)).data;
    },
    async listPartners(type) {
      return (await req<{ data: Partner[] }>('GET', '/partners', { query: { type } })).data;
    },
    async getPublicSettings() {
      return (await req<{ data: PublicSettings }>('GET', '/settings/public')).data;
    },
    async subscribeNewsletter(input) {
      await req('POST', '/newsletter/subscribe', { body: input });
      return NEWSLETTER_NEUTRAL_MESSAGE; // jamais de message serveur : anti-énumération
    },
    async confirmNewsletter(token) {
      await req('GET', '/newsletter/confirm', { query: { token } });
    },
    async unsubscribeNewsletter(token) {
      await req('POST', '/newsletter/unsubscribe', { body: { token } });
    },

    contentListPosts(query = {}) {
      return req<Paginated<ContentPostRow>>('GET', '/content/posts', {
        query: { status: query.status, category: query.category, q: query.q, page: query.page },
      });
    },
    async contentGetPost(id) {
      return (await req<{ data: ContentPost }>('GET', `/content/posts/${id}`)).data;
    },
    async contentCreatePost(input) {
      return (await req<{ data: ContentPost }>('POST', '/content/posts', { body: input })).data;
    },
    async contentUpdatePost(id, input) {
      return (await req<{ data: ContentPost }>('PATCH', `/content/posts/${id}`, { body: input }))
        .data;
    },
    async contentDeletePost(id) {
      await req('DELETE', `/content/posts/${id}`);
    },
    async contentUploadMedia(file, alt) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('alt', alt);
      const res = await req<MediaUpload | { data: MediaUpload }>('POST', '/content/media', {
        formData,
      });
      return 'data' in res ? res.data : res;
    },
    contentListComments(query = {}) {
      return req<Paginated<ContentComment>>('GET', '/content/comments', {
        query: { status: query.status, page: query.page },
      });
    },
    async contentModerateComment(id, status) {
      await req('PATCH', `/content/comments/${id}`, { body: { status } });
    },
    async contentListCategories() {
      return (await req<{ data: ContentCategory[] }>('GET', '/content/categories')).data;
    },
    async contentUpdateCategory(id, input) {
      return (
        await req<{ data: ContentCategory }>('PATCH', `/content/categories/${id}`, { body: input })
      ).data;
    },
    async contentGetPage(slug) {
      return (await req<{ data: ContentPage }>('GET', `/content/pages/${encodeURIComponent(slug)}`))
        .data;
    },
    async contentUpdatePage(slug, input) {
      return (
        await req<{ data: ContentPage }>('PUT', `/content/pages/${encodeURIComponent(slug)}`, {
          body: input,
        })
      ).data;
    },
    async contentListPartners(type) {
      return (await req<{ data: ContentPartner[] }>('GET', '/content/partners', { query: { type } }))
        .data;
    },
    async contentCreatePartner(input) {
      return (await req<{ data: ContentPartner }>('POST', '/content/partners', { body: input })).data;
    },
    async contentUpdatePartner(id, input) {
      return (
        await req<{ data: ContentPartner }>('PATCH', `/content/partners/${id}`, { body: input })
      ).data;
    },
    async contentDeletePartner(id) {
      await req('DELETE', `/content/partners/${id}`);
    },
    async adminGetSettings() {
      return (await req<{ data: AdminSetting[] }>('GET', '/admin/settings')).data;
    },
    async adminUpdateSettings(settings) {
      return (await req<{ data: AdminSetting[] }>('PUT', '/admin/settings', { body: { settings } }))
        .data;
    },
    adminListSubscribers(query = {}) {
      return req<Paginated<NewsletterSubscriber>>('GET', '/admin/newsletter/subscribers', {
        query: { status: query.status, q: query.q, page: query.page },
      });
    },
  };
}
