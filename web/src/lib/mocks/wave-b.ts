import { ApiError } from '../api/errors';
import type { Api } from '../api/endpoints';
import type {
  AdminContactMessage,
  AdminFeedback,
  AdminFeedbackRow,
  AdminQuote,
  AdminQuoteRow,
  AdminReviewReport,
  AdminReviewRow,
  ContactStatus,
  FeedbackReply,
  FeedbackStatus,
  MyReview,
  OwnerReview,
  ProviderQuote,
  QuoteRecipientStatus,
  QuoteStatus,
  Review,
  ReviewReportReason,
  ReviewReportStatus,
  ReviewStatus,
} from '../api/types';
import type { MockContext, MockSession } from './establishments';
import { providers, reviewsBySlug } from './providers';
import { cities, feedbackTopics, serviceTypes } from './reference';

/**
 * Données et logique FICTIVES de la vague B (avis, « Dis-moi tout », devis, contact).
 * Tout est en mémoire (rechargement = remise à zéro). Aucune donnée réelle.
 *
 * Comptes de démonstration :
 *  - `proprietaire1@example.test` … `proprietaire6@example.test` (rôle prestataire) : propriétaires
 *    des 6 premières fiches publiées => avis reçus, devis reçus ;
 *  - un e-mail commençant par `client` possède 3 avis (publié, en attente, rejeté avec motif) ;
 *  - `limite@example.test` dans un formulaire public simule un 429.
 * Références de suivi « Dis-moi tout » de démonstration : DMT-2026-000101 avec awa.demo@example.test.
 */

export type WaveBApi = Pick<
  Api,
  | 'createReview'
  | 'listMyReviews'
  | 'updateMyReview'
  | 'deleteMyReview'
  | 'reportReview'
  | 'listOwnerReviews'
  | 'replyToReview'
  | 'listProviderReviews'
  | 'adminListReviews'
  | 'adminReviewAction'
  | 'adminDeleteReview'
  | 'adminListReviewReports'
  | 'adminReviewReportAction'
  | 'createFeedback'
  | 'trackFeedback'
  | 'adminListFeedbacks'
  | 'adminGetFeedback'
  | 'adminUpdateFeedback'
  | 'adminReplyFeedback'
  | 'createQuoteRequest'
  | 'listMyQuotes'
  | 'getMyQuote'
  | 'replyToQuote'
  | 'declineQuote'
  | 'adminListQuotes'
  | 'adminGetQuote'
  | 'adminDispatchQuote'
  | 'adminUpdateQuoteStatus'
  | 'sendContact'
  | 'adminListContactMessages'
  | 'adminUpdateContactMessage'
  | 'adminReplyContactMessage'
>;

export interface WaveBDashboardCounts {
  pending_reviews: number;
  open_review_reports: number;
  new_feedbacks: number;
  new_quote_requests: number;
  new_contact_messages: number;
}

const notFound = () => new ApiError(404, 'Cette page ou cette ressource est introuvable.');
const forbidden = (m = "Vous n'avez pas l'autorisation d'effectuer cette action.") =>
  new ApiError(403, m);
const conflict = (m: string) => new ApiError(409, m);
const invalid = (field: string, message: string) =>
  new ApiError(422, 'Certaines informations sont invalides.', { [field]: [message] });
const tooMany = () =>
  new ApiError(429, 'Trop de tentatives. Patientez un instant avant de réessayer.', {}, 60);

const ADMINS = [
  { id: 1, name: 'Admin Démo' },
  { id: 2, name: 'Salimata Ouattara' },
];

interface ReviewRec {
  id: number;
  providerSlug: string;
  authorEmail: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  rejection_reason: string | null;
  is_visible: boolean;
  created_at: string;
  provider_reply: string | null;
  provider_replied_at: string | null;
  deleted: boolean;
}

interface ReportRec {
  id: number;
  reviewId: number;
  reporterEmail: string;
  reporterName: string;
  reason: ReviewReportReason;
  details: string | null;
  status: ReviewReportStatus;
  created_at: string;
}

interface FeedbackRec {
  id: number;
  reference: string;
  civility: AdminFeedback['civility'];
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  providerSlug: string | null;
  action_type: AdminFeedback['action_type'];
  target_type: AdminFeedback['target_type'];
  service_type_id: number | null;
  topic_id: number | null;
  product_type: string | null;
  location: string | null;
  comment: string;
  status: FeedbackStatus;
  assigned_to: number | null;
  created_at: string;
  resolved_at: string | null;
  replies: FeedbackReply[];
}

interface RecipientRec {
  id: number;
  providerSlug: string;
  status: QuoteRecipientStatus;
  sent_at: string;
  viewed_at: string | null;
  replied_at: string | null;
  response_message: string | null;
  quoted_amount: number | null;
}

interface QuoteRec {
  id: number;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string | null;
  service_type_id: number;
  city_id: number;
  district_id: number | null;
  description: string;
  desired_start_date: string | null;
  budget_range: string | null;
  status: QuoteStatus;
  created_at: string;
  recipients: RecipientRec[];
}

const providerIndex = (slug: string) => providers.findIndex((p) => p.slug === slug);
const providerId = (slug: string) => providerIndex(slug) + 1;
const initialOf = (name: string) => name.trim().slice(0, 1).toUpperCase();
const shortName = (first: string, last: string) => `${first.trim()} ${initialOf(last)}.`;

function isoDaysAgo(days: number, hour = 9): string {
  return new Date(Date.UTC(2026, 9, 8 - days, hour, 0, 0)).toISOString().replace('.000', '');
}

export function createWaveBMocks(
  ctx: MockContext,
): WaveBApi & { dashboardCounts(): WaveBDashboardCounts } {
  let seq = 5000;
  const next = () => ++seq;

  /* ---------- Avis ---------- */
  const reviews: ReviewRec[] = [];
  Object.entries(reviewsBySlug).forEach(([slug, list]) => {
    for (const r of list) {
      reviews.push({
        id: r.id,
        providerSlug: slug,
        authorEmail: `auteur-${r.id}@example.test`,
        authorName: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: 'approved',
        rejection_reason: null,
        is_visible: true,
        created_at: r.created_at,
        provider_reply: r.provider_reply,
        provider_replied_at: r.provider_replied_at,
        deleted: false,
      });
    }
  });
  const addReview = (rec: Omit<ReviewRec, 'id' | 'deleted' | 'provider_reply' | 'provider_replied_at'> & Partial<ReviewRec>) => {
    const full: ReviewRec = {
      id: next(),
      deleted: false,
      provider_reply: null,
      provider_replied_at: null,
      ...rec,
    };
    reviews.push(full);
    return full;
  };
  const slugAt = (i: number) => providers[i % providers.length]!.slug;
  addReview({
    providerSlug: slugAt(2),
    authorEmail: 'client.demo@example.test',
    authorName: 'Awa K.',
    rating: 4,
    title: 'Service fiable',
    body: 'Les agents sont arrivés à l’heure et ont été très courtois pendant toute la durée de la mission.',
    status: 'approved',
    rejection_reason: null,
    is_visible: true,
    created_at: isoDaysAgo(20),
  });
  addReview({
    providerSlug: slugAt(3),
    authorEmail: 'client.demo@example.test',
    authorName: 'Awa K.',
    rating: 5,
    title: 'Installation soignée',
    body: 'Installation propre et rapide, avec des explications claires sur le fonctionnement du système.',
    status: 'pending',
    rejection_reason: null,
    is_visible: false,
    created_at: isoDaysAgo(2),
  });
  addReview({
    providerSlug: slugAt(4),
    authorEmail: 'client.demo@example.test',
    authorName: 'Awa K.',
    rating: 1,
    title: null,
    body: 'Je ne suis pas satisfait, mais je préfère ne pas détailler davantage dans cet avis.',
    status: 'rejected',
    rejection_reason:
      'Votre avis ne décrit aucun fait précis sur le service reçu. Merci de le reformuler avec des éléments concrets.',
    is_visible: false,
    created_at: isoDaysAgo(6),
  });
  const pendingSeeds: [number, string, string, number, string][] = [
    [0, 'Koffi A.', 'Koffi Alla', 5, 'Contrat clair et équipe réactive, nous renouvelons pour l’an prochain.'],
    [0, 'Mariam S.', 'Mariam Sylla', 3, 'Service correct mais des retards de remplacement des agents en soirée.'],
    [1, 'Jean-Marc D.', 'Jean-Marc Dosso', 4, 'Bonne couverture de nos locaux, les rapports quotidiens sont appréciables.'],
  ];
  pendingSeeds.forEach(([i, short, , rating, body], k) =>
    addReview({
      providerSlug: slugAt(i),
      authorEmail: `en-attente-${k}@example.test`,
      authorName: short,
      rating,
      title: null,
      body,
      status: 'pending',
      rejection_reason: null,
      is_visible: false,
      created_at: isoDaysAgo(k + 1),
    }),
  );

  const reports: ReportRec[] = [];
  const reportedTarget = reviews.find((r) => r.providerSlug === slugAt(1) && r.status === 'approved');
  if (reportedTarget) {
    (
      [
        ['spam', 'Contenu promotionnel'],
        ['false_info', null],
      ] as [ReviewReportReason, string | null][]
    ).forEach(([reason, details], k) =>
      reports.push({
        id: next(),
        reviewId: reportedTarget.id,
        reporterEmail: `signalant-${k}@example.test`,
        reporterName: k === 0 ? 'Ibrahim T.' : 'Nadia B.',
        reason,
        details,
        status: 'open',
        created_at: isoDaysAgo(k + 1, 14),
      }),
    );
  }

  const ownedIndexes = (s: MockSession): number[] => {
    const m = /^proprietaire(\d+)@example\.test$/i.exec(s.email);
    if (!m) return [];
    const i = Number(m[1]) - 1;
    return i >= 0 && i < providers.length ? [i] : [];
  };
  const ownsSlug = (s: MockSession, slug: string) =>
    ownedIndexes(s).some((i) => providers[i]!.slug === slug);

  function requireAdmin(): MockSession {
    const s = ctx.requireSession();
    if (s.role !== 'admin' || !s.two_factor) throw forbidden();
    return s;
  }
  function requireOwner(slug: string): MockSession {
    const s = ctx.requireSession();
    if (!ownsSlug(s, slug)) throw notFound(); // fiche d'autrui : 404
    return s;
  }
  const visibleReview = (r: ReviewRec) => !r.deleted && r.status === 'approved' && r.is_visible;
  const providerName = (slug: string) => providers[providerIndex(slug)]?.name ?? '—';

  const toMy = (r: ReviewRec): MyReview => ({
    id: r.id,
    provider: { slug: r.providerSlug, name: providerName(r.providerSlug) },
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    rejection_reason: r.rejection_reason,
    is_visible: r.is_visible,
    created_at: r.created_at,
    provider_reply: r.provider_reply,
  });
  const toPublic = (r: ReviewRec): Review => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    author: r.authorName,
    created_at: r.created_at,
    provider_reply: r.provider_reply,
    provider_replied_at: r.provider_replied_at,
  });
  const toOwner = (r: ReviewRec): OwnerReview => ({ ...toPublic(r), status: r.status });
  const toAdminRow = (r: ReviewRec): AdminReviewRow => ({
    id: r.id,
    provider: { id: providerId(r.providerSlug), slug: r.providerSlug, name: providerName(r.providerSlug) },
    author: { id: 900 + (r.id % 100), name: r.authorName, email: r.authorEmail },
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    is_visible: r.is_visible,
    reports_count: reports.filter((x) => x.reviewId === r.id && x.status === 'open').length,
    created_at: r.created_at,
  });

  function checkReview(input: { rating?: unknown; title?: unknown; body?: unknown }, partial: boolean) {
    if (!partial || input.rating !== undefined) {
      const n = Number(input.rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw invalid('rating', 'Choisissez une note de 1 à 5.');
    }
    if (!partial || input.body !== undefined) {
      const body = String(input.body ?? '').trim();
      if (body.length < 10) throw invalid('body', 'Votre avis doit comporter au moins 10 caractères.');
      if (body.length > 3000) throw invalid('body', 'Votre avis ne doit pas dépasser 3000 caractères.');
    }
    if (input.title && String(input.title).length > 150)
      throw invalid('title', 'Le titre ne doit pas dépasser 150 caractères.');
  }

  /* ---------- Dis-moi tout ---------- */
  const feedbacks: FeedbackRec[] = [];
  const feedbackKeys = new Map<string, FeedbackRec>();
  let feedbackSeq = 100;
  const ref = (prefix: string, n: number) => `${prefix}-2026-${String(n).padStart(6, '0')}`;

  const seedFeedback = (
    partial: Partial<FeedbackRec> & Pick<FeedbackRec, 'first_name' | 'last_name' | 'email' | 'action_type' | 'target_type' | 'comment' | 'status'>,
  ) => {
    const rec: FeedbackRec = {
      id: ++feedbackSeq,
      reference: ref('DMT', feedbackSeq),
      civility: null,
      phone: null,
      providerSlug: null,
      service_type_id: null,
      topic_id: null,
      product_type: null,
      location: null,
      assigned_to: null,
      created_at: isoDaysAgo(feedbackSeq - 99),
      resolved_at: null,
      replies: [],
      ...partial,
    };
    feedbacks.push(rec);
    return rec;
  };
  const f1 = seedFeedback({
    civility: 'Mme',
    first_name: 'Awa',
    last_name: 'Koné',
    email: 'awa.demo@example.test',
    providerSlug: slugAt(0),
    action_type: 'complaint',
    target_type: 'service',
    service_type_id: 1,
    topic_id: 4,
    location: 'Plateau, Abidjan',
    comment: 'Les agents sont arrivés avec plus d’une heure de retard le jour de notre événement.',
    status: 'in_progress',
    assigned_to: 1,
  });
  f1.replies.push(
    {
      id: next(),
      author: { id: 1, name: 'Admin Démo' },
      body: 'Dossier transmis au responsable du prestataire pour explication.',
      is_internal: true,
      sent_at: null,
      created_at: isoDaysAgo(2, 11),
    },
    {
      id: next(),
      author: { id: 1, name: 'Admin Démo' },
      body: 'Bonjour, nous avons bien reçu votre plainte et le prestataire a été contacté. Nous revenons vers vous très vite.',
      is_internal: false,
      sent_at: isoDaysAgo(2, 12),
      created_at: isoDaysAgo(2, 12),
    },
  );
  seedFeedback({
    first_name: 'Yves',
    last_name: 'Gnagne',
    email: 'yves.demo@example.test',
    action_type: 'encouragement',
    target_type: 'employee',
    topic_id: 1,
    providerSlug: slugAt(1),
    comment: 'Bravo à l’agent de l’accueil, toujours souriant et très serviable.',
    status: 'new',
  });
  seedFeedback({
    first_name: 'Mariam',
    last_name: 'Bamba',
    email: 'mariam.demo@example.test',
    action_type: 'question',
    target_type: 'product',
    product_type: 'Caméra de surveillance',
    comment: 'Quels sont les critères pour choisir une caméra adaptée à un petit commerce ?',
    status: 'new',
  });
  seedFeedback({
    first_name: 'Paul',
    last_name: 'Traoré',
    email: 'paul.demo@example.test',
    action_type: 'suggestion',
    target_type: 'service',
    service_type_id: 4,
    topic_id: 6,
    comment: 'Il serait utile de pouvoir comparer les tarifs de plusieurs prestataires dans l’annuaire.',
    status: 'resolved',
    resolved_at: isoDaysAgo(5),
  });
  seedFeedback({
    first_name: 'Fatou',
    last_name: 'Diallo',
    email: 'fatou.demo@example.test',
    action_type: 'complaint',
    target_type: 'service',
    service_type_id: 3,
    topic_id: 7,
    providerSlug: slugAt(2),
    comment: 'La facture reçue ne correspond pas au devis signé pour la prestation de gardiennage.',
    status: 'closed',
    resolved_at: isoDaysAgo(12),
  });

  const optionById = (list: { id: number; slug: string; name: string }[], id: number | null) =>
    list.find((o) => o.id === id) ?? null;
  const adminName = (id: number | null) => {
    const a = ADMINS.find((x) => x.id === id);
    return a ? { id: a.id, name: a.name } : null;
  };
  const toFeedbackRow = (f: FeedbackRec): AdminFeedbackRow => ({
    id: f.id,
    reference: f.reference,
    author: { first_name: f.first_name, last_name: f.last_name, email: f.email },
    provider: f.providerSlug ? { id: providerId(f.providerSlug), name: providerName(f.providerSlug) } : null,
    action_type: f.action_type,
    target_type: f.target_type,
    status: f.status,
    assigned_to: adminName(f.assigned_to),
    created_at: f.created_at,
  });
  const toFeedback = (f: FeedbackRec): AdminFeedback => ({
    ...toFeedbackRow(f),
    civility: f.civility,
    phone: f.phone,
    service_type: optionById(serviceTypes, f.service_type_id),
    topic: optionById(feedbackTopics, f.topic_id),
    product_type: f.product_type,
    location: f.location,
    comment: f.comment,
    consent_at: f.created_at,
    resolved_at: f.resolved_at,
    replies: structuredClone(f.replies),
  });

  /* ---------- Devis ---------- */
  const quotes: QuoteRec[] = [];
  const quoteKeys = new Map<string, QuoteRec>();
  let quoteSeq = 100;
  const addQuote = (partial: Partial<QuoteRec> & Pick<QuoteRec, 'first_name' | 'last_name' | 'email' | 'phone' | 'description' | 'status'>) => {
    const rec: QuoteRec = {
      id: ++quoteSeq,
      reference: ref('DEV', quoteSeq),
      company_name: null,
      service_type_id: 1,
      city_id: 1,
      district_id: null,
      desired_start_date: null,
      budget_range: null,
      created_at: isoDaysAgo(quoteSeq - 100),
      recipients: [],
      ...partial,
    };
    quotes.push(rec);
    return rec;
  };
  const recipient = (slug: string, status: QuoteRecipientStatus, extra: Partial<RecipientRec> = {}): RecipientRec => ({
    id: next(),
    providerSlug: slug,
    status,
    sent_at: isoDaysAgo(3, 10),
    viewed_at: null,
    replied_at: null,
    response_message: null,
    quoted_amount: null,
    ...extra,
  });
  addQuote({
    first_name: 'Serge',
    last_name: 'Kouadio',
    email: 'serge.demo@example.test',
    phone: '+2250700000010',
    company_name: 'Boulangerie Soleil',
    service_type_id: 2,
    city_id: 1,
    description: 'Gardiennage de nuit pour une boulangerie industrielle, du lundi au samedi, deux agents.',
    desired_start_date: '2026-11-02',
    budget_range: '300 000 à 500 000 FCFA / mois',
    status: 'sent',
    recipients: [recipient(slugAt(0), 'sent'), recipient(slugAt(1), 'sent')],
  });
  addQuote({
    first_name: 'Adjoua',
    last_name: 'N’Guessan',
    email: 'adjoua.demo@example.test',
    phone: '+2250700000011',
    service_type_id: 4,
    city_id: 1,
    description: 'Installation de quatre caméras de vidéosurveillance dans une villa avec accès à distance.',
    status: 'answered',
    recipients: [
      recipient(slugAt(0), 'replied', {
        viewed_at: isoDaysAgo(2, 9),
        replied_at: isoDaysAgo(2, 15),
        response_message: 'Bonjour, nous pouvons intervenir sous 10 jours. Devis détaillé joint à ce message.',
        quoted_amount: 850000,
      }),
    ],
  });
  addQuote({
    first_name: 'Ibrahim',
    last_name: 'Coulibaly',
    email: 'ibrahim.demo@example.test',
    phone: '+2250700000012',
    service_type_id: 10,
    city_id: 2,
    description: 'Sécurité incendie : audit et formation du personnel d’un petit hôtel de vingt chambres.',
    status: 'new',
  });
  addQuote({
    first_name: 'Rose',
    last_name: 'Aka',
    email: 'rose.demo@example.test',
    phone: '+2250700000013',
    service_type_id: 11,
    city_id: 1,
    description: 'Sécurité d’un mariage de deux cents invités, quatre agents pour une soirée en novembre.',
    status: 'sent',
    recipients: [recipient(slugAt(0), 'viewed', { viewed_at: isoDaysAgo(1, 8) }), recipient(slugAt(1), 'declined')],
  });

  const service = (id: number) => optionById(serviceTypes, id) ?? serviceTypes[0]!;
  const cityName = (id: number) => cities.find((c) => c.id === id)?.name ?? '—';
  const districtName = (cityId: number, districtId: number | null) =>
    districtId ? (cities.find((c) => c.id === cityId)?.districts.find((d) => d.id === districtId)?.name ?? null) : null;

  const toProviderQuote = (q: QuoteRec, r: RecipientRec): ProviderQuote => ({
    id: q.id,
    reference: q.reference,
    requester: {
      name: `${q.first_name} ${q.last_name}`,
      email: q.email,
      phone: q.phone,
      company_name: q.company_name,
    },
    service: service(q.service_type_id),
    city: { name: cityName(q.city_id) },
    district: districtName(q.city_id, q.district_id) ? { name: districtName(q.city_id, q.district_id)! } : null,
    description: q.description,
    desired_start_date: q.desired_start_date,
    budget_range: q.budget_range,
    status: r.status,
    sent_at: r.sent_at,
    viewed_at: r.viewed_at,
    replied_at: r.replied_at,
    response_message: r.response_message,
    quoted_amount: r.quoted_amount,
  });
  const toQuoteRow = (q: QuoteRec): AdminQuoteRow => ({
    id: q.id,
    reference: q.reference,
    requester_name: `${q.first_name} ${q.last_name}`,
    requester_email: q.email,
    service: service(q.service_type_id),
    city: { name: cityName(q.city_id) },
    status: q.status,
    recipients_count: q.recipients.length,
    created_at: q.created_at,
  });
  const toAdminQuote = (q: QuoteRec): AdminQuote => ({
    ...toQuoteRow(q),
    phone: q.phone,
    company_name: q.company_name,
    description: q.description,
    desired_start_date: q.desired_start_date,
    budget_range: q.budget_range,
    recipients: q.recipients.map((r) => ({
      id: r.id,
      provider: { id: providerId(r.providerSlug), name: providerName(r.providerSlug) },
      status: r.status,
      sent_at: r.sent_at,
      viewed_at: r.viewed_at,
      replied_at: r.replied_at,
      response_message: r.response_message,
      quoted_amount: r.quoted_amount,
    })),
  });
  function myRecipient(s: MockSession, id: number): { q: QuoteRec; r: RecipientRec } {
    const slugs = ownedIndexes(s).map((i) => providers[i]!.slug);
    const q = quotes.find((x) => x.id === id);
    const r = q?.recipients.find((x) => slugs.includes(x.providerSlug));
    if (!q || !r) throw notFound();
    return { q, r };
  }

  /* ---------- Contact ---------- */
  const messages: (AdminContactMessage & { key?: string })[] = [
    {
      id: 301,
      name: 'Ousmane Kané',
      email: 'ousmane.demo@example.test',
      subject: 'Partenariat avec ProtectIci',
      message: 'Bonjour, nous souhaiterions devenir partenaire de la plateforme. Qui contacter ?',
      status: 'new',
      handled_by: null,
      handled_at: null,
      created_at: isoDaysAgo(1),
    },
    {
      id: 302,
      name: 'Léa Brou',
      email: 'lea.demo@example.test',
      subject: 'Problème d’accès à mon compte',
      message: 'Je ne reçois pas l’e-mail de confirmation après mon inscription. Pouvez-vous m’aider ?',
      status: 'read',
      handled_by: { id: 1, name: 'Admin Démo' },
      handled_at: isoDaysAgo(3),
      created_at: isoDaysAgo(4),
    },
    {
      id: 303,
      name: 'Marc Yao',
      email: 'marc.demo@example.test',
      subject: 'Suppression d’une fiche',
      message: 'Mon entreprise a cessé son activité. Comment retirer sa fiche de l’annuaire ?',
      status: 'answered',
      handled_by: { id: 2, name: 'Salimata Ouattara' },
      handled_at: isoDaysAgo(8),
      created_at: isoDaysAgo(9),
    },
  ];
  const contactKeys = new Map<string, string>();
  let messageSeq = 303;

  /* ---------- Formulaires publics : utilitaires ---------- */
  function guardPublic(input: { email?: string; consent?: boolean }) {
    if (input.email?.toLowerCase() === 'limite@example.test') throw tooMany();
    if (input.consent !== true)
      throw invalid('consent', 'Vous devez accepter le traitement de vos informations.');
  }
  const need = (field: string, value: unknown, label: string) => {
    if (typeof value !== 'string' || !value.trim()) throw invalid(field, `${label} est requis.`);
  };
  const emailOk = (value: unknown) => {
    if (typeof value !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()))
      throw invalid('email', "L'adresse e-mail n'est pas valide.");
  };
  const between = (field: string, value: unknown, min: number, max: number, label: string) => {
    const n = String(value ?? '').trim().length;
    if (n < min) throw invalid(field, `${label} doit comporter au moins ${min} caractères.`);
    if (n > max) throw invalid(field, `${label} ne doit pas dépasser ${max} caractères.`);
  };

  return {
    dashboardCounts() {
      return {
        pending_reviews: reviews.filter((r) => !r.deleted && r.status === 'pending').length,
        open_review_reports: reports.filter((r) => r.status === 'open').length,
        new_feedbacks: feedbacks.filter((f) => f.status === 'new').length,
        new_quote_requests: quotes.filter((q) => q.status === 'new').length,
        new_contact_messages: messages.filter((m) => m.status === 'new').length,
      };
    },

    /* ----- Avis ----- */
    async listProviderReviews(slug, page, perPage) {
      if (providerIndex(slug) < 0) throw notFound();
      const list = reviews
        .filter((r) => r.providerSlug === slug && visibleReview(r))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toPublic);
      return ctx.paginate(list, page, perPage ?? 5);
    },
    async createReview(slug, input) {
      const s = ctx.requireSession();
      await ctx.delay();
      if (!s.verified) throw forbidden('Veuillez vérifier votre adresse e-mail pour publier un avis.');
      if (providerIndex(slug) < 0) throw notFound();
      if (ownsSlug(s, slug)) throw forbidden('Vous ne pouvez pas donner un avis sur votre propre fiche.');
      checkReview(input, false);
      if (reviews.some((r) => !r.deleted && r.providerSlug === slug && r.authorEmail.toLowerCase() === s.email.toLowerCase()))
        throw conflict('Vous avez déjà donné un avis pour ce prestataire.');
      const rec = addReview({
        providerSlug: slug,
        authorEmail: s.email,
        authorName: shortName(s.first_name, s.last_name),
        rating: Number(input.rating),
        title: input.title?.trim() || null,
        body: input.body.trim(),
        status: 'pending',
        rejection_reason: null,
        is_visible: false,
        created_at: new Date().toISOString(),
      });
      return toMy(rec);
    },
    async listMyReviews(page) {
      const s = ctx.requireSession();
      await ctx.delay();
      const list = reviews
        .filter((r) => !r.deleted && r.authorEmail.toLowerCase() === s.email.toLowerCase())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toMy);
      return ctx.paginate(list, page);
    },
    async updateMyReview(id, patch) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = reviews.find((x) => x.id === id && !x.deleted && x.authorEmail.toLowerCase() === s.email.toLowerCase());
      if (!r) throw notFound();
      checkReview(patch, true);
      if (patch.rating !== undefined) r.rating = Number(patch.rating);
      if (patch.title !== undefined) r.title = patch.title?.trim() || null;
      if (patch.body !== undefined) r.body = patch.body.trim();
      r.status = 'pending'; // toute modification repasse en modération et masque l'avis
      r.is_visible = false;
      r.rejection_reason = null;
      return toMy(r);
    },
    async deleteMyReview(id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = reviews.find((x) => x.id === id && !x.deleted && x.authorEmail.toLowerCase() === s.email.toLowerCase());
      if (!r) throw notFound();
      r.deleted = true;
    },
    async reportReview(id, input) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = reviews.find((x) => x.id === id);
      if (!r || !visibleReview(r)) throw notFound();
      if (!['spam', 'offensive', 'false_info', 'other'].includes(input.reason))
        throw invalid('reason', 'Choisissez une raison.');
      if (reports.some((x) => x.reviewId === id && x.reporterEmail.toLowerCase() === s.email.toLowerCase()))
        return; // rejeu = 204
      reports.push({
        id: next(),
        reviewId: id,
        reporterEmail: s.email,
        reporterName: shortName(s.first_name, s.last_name),
        reason: input.reason,
        details: input.details?.trim() || null,
        status: 'open',
        created_at: new Date().toISOString(),
      });
    },
    async listOwnerReviews(slug, query = {}) {
      requireOwner(slug);
      await ctx.delay();
      const list = reviews
        .filter((r) => r.providerSlug === slug && !r.deleted)
        .filter((r) => !query.status || r.status === query.status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toOwner);
      return ctx.paginate(list, query.page);
    },
    async replyToReview(slug, reviewId, body) {
      requireOwner(slug);
      await ctx.delay();
      const r = reviews.find((x) => x.id === reviewId && x.providerSlug === slug && !x.deleted);
      if (!r || r.status !== 'approved') throw notFound();
      between('body', body, 5, 1500, 'La réponse');
      if (r.provider_reply) throw conflict('Vous avez déjà répondu à cet avis.');
      r.provider_reply = body.trim();
      r.provider_replied_at = new Date().toISOString();
    },
    async adminListReviews(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const status = query.status ?? 'pending';
      const list = reviews
        .filter((r) => !r.deleted && r.status === status)
        .filter((r) => !query.provider || r.providerSlug === query.provider)
        .filter((r) => !q || r.body.toLowerCase().includes(q) || r.authorName.toLowerCase().includes(q) || providerName(r.providerSlug).toLowerCase().includes(q))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toAdminRow);
      return ctx.paginate(list, query.page);
    },
    async adminReviewAction(id, action, reason) {
      requireAdmin();
      await ctx.delay();
      const r = reviews.find((x) => x.id === id && !x.deleted);
      if (!r) throw notFound();
      if (action === 'approve') {
        r.status = 'approved';
        r.is_visible = true;
        r.rejection_reason = null;
      } else {
        if (!reason || reason.trim().length < 10)
          throw invalid('reason', 'Le motif doit comporter au moins 10 caractères.');
        if (r.status === 'rejected') return; // idempotent
        r.status = 'rejected';
        r.is_visible = false;
        r.rejection_reason = reason.trim();
      }
    },
    async adminDeleteReview(id) {
      requireAdmin();
      await ctx.delay();
      const r = reviews.find((x) => x.id === id);
      if (!r) throw notFound();
      r.deleted = true;
    },
    async adminListReviewReports(query = {}) {
      requireAdmin();
      await ctx.delay();
      const status = query.status ?? 'open';
      const list: AdminReviewReport[] = reports
        .filter((x) => x.status === status)
        .filter((x) => reviews.some((r) => r.id === x.reviewId && !r.deleted))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((x) => {
          const r = reviews.find((rv) => rv.id === x.reviewId)!;
          return {
            id: x.id,
            review: {
              id: r.id,
              rating: r.rating,
              body_excerpt: r.body.length > 140 ? `${r.body.slice(0, 137)}…` : r.body,
              provider_name: providerName(r.providerSlug),
            },
            reporter: { id: 700 + (x.id % 100), name: x.reporterName },
            reason: x.reason,
            details: x.details,
            status: x.status,
            created_at: x.created_at,
          };
        });
      return ctx.paginate(list, query.page);
    },
    async adminReviewReportAction(id, action) {
      requireAdmin();
      await ctx.delay();
      const rep = reports.find((x) => x.id === id);
      if (!rep) throw notFound();
      if (rep.status !== 'open') return; // idempotent
      if (action === 'accept') {
        rep.status = 'accepted';
        const r = reviews.find((x) => x.id === rep.reviewId);
        if (r) {
          r.is_visible = false;
          r.status = 'rejected';
          r.rejection_reason = 'Avis masqué suite à un signalement accepté.';
        }
      } else {
        rep.status = 'dismissed';
      }
    },

    /* ----- Dis-moi tout ----- */
    async createFeedback(input, idempotencyKey) {
      await ctx.delay();
      if (input.company_website) {
        // Robot : succès simulé identique, rien n'est enregistré.
        return { reference: ref('DMT', ++feedbackSeq), status: 'new', message: 'Votre message a bien été reçu. Conservez ce numéro de suivi.' };
      }
      const previous = feedbackKeys.get(idempotencyKey);
      if (previous)
        return { reference: previous.reference, status: previous.status, message: 'Votre message a bien été reçu. Conservez ce numéro de suivi.' };
      guardPublic(input);
      need('last_name', input.last_name, 'Le nom');
      need('first_name', input.first_name, 'Le prénom');
      emailOk(input.email);
      if (!['encouragement', 'question', 'complaint', 'suggestion'].includes(input.action_type))
        throw invalid('action_type', 'Choisissez ce que vous désirez faire.');
      if (!['employee', 'product', 'service'].includes(input.target_type))
        throw invalid('target_type', 'Précisez l’objet de votre message.');
      if (input.target_type !== 'product' && !input.topic_id) throw invalid('topic_id', 'Choisissez le sujet concerné.');
      if (input.target_type === 'service' && !input.service_type_id)
        throw invalid('service_type_id', 'Choisissez le type de prestation.');
      between('comment', input.comment, 10, 3000, 'Le commentaire');
      if (input.provider_slug && providerIndex(input.provider_slug) < 0)
        throw invalid('provider_slug', 'Ce prestataire est introuvable.');
      const rec: FeedbackRec = {
        id: ++feedbackSeq,
        reference: ref('DMT', feedbackSeq),
        civility: input.civility ?? null,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        providerSlug: input.provider_slug || null,
        action_type: input.action_type,
        target_type: input.target_type,
        service_type_id: input.service_type_id ?? null,
        topic_id: input.topic_id ?? null,
        product_type: input.product_type?.trim() || null,
        location: input.location?.trim() || null,
        comment: input.comment.trim(),
        status: 'new',
        assigned_to: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        replies: [],
      };
      feedbacks.unshift(rec);
      feedbackKeys.set(idempotencyKey, rec);
      return { reference: rec.reference, status: 'new', message: 'Votre message a bien été reçu. Conservez ce numéro de suivi.' };
    },
    async trackFeedback(input) {
      await ctx.delay();
      if (input.email?.toLowerCase() === 'limite@example.test') throw tooMany();
      const f = feedbacks.find(
        (x) => x.reference === String(input.reference).trim().toUpperCase() && x.email.toLowerCase() === String(input.email).trim().toLowerCase(),
      );
      if (!f) throw new ApiError(404, 'Aucun dossier ne correspond à ces informations.');
      return {
        reference: f.reference,
        status: f.status,
        created_at: f.created_at,
        provider_name: f.providerSlug ? providerName(f.providerSlug) : null,
        replies: f.replies.filter((r) => !r.is_internal).map((r) => ({ body: r.body, created_at: r.created_at })),
      };
    },
    async adminListFeedbacks(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const list = feedbacks
        .filter((f) => !query.status || f.status === query.status)
        .filter((f) => !query.action_type || f.action_type === query.action_type)
        .filter((f) => !query.provider || f.providerSlug === query.provider)
        .filter((f) => !query.assigned_to || f.assigned_to === query.assigned_to)
        .filter(
          (f) =>
            !q ||
            f.reference.toLowerCase().includes(q) ||
            `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) ||
            f.email.toLowerCase().includes(q),
        )
        .sort((a, b) =>
          query.sort === 'status' ? a.status.localeCompare(b.status) : b.created_at.localeCompare(a.created_at),
        )
        .map(toFeedbackRow);
      return ctx.paginate(list, query.page);
    },
    async adminGetFeedback(id) {
      requireAdmin();
      await ctx.delay();
      const f = feedbacks.find((x) => x.id === id);
      if (!f) throw notFound();
      return toFeedback(f);
    },
    async adminUpdateFeedback(id, patch) {
      requireAdmin();
      await ctx.delay();
      const f = feedbacks.find((x) => x.id === id);
      if (!f) throw notFound();
      if (patch.status !== undefined) {
        if (!['new', 'in_progress', 'forwarded', 'resolved', 'closed'].includes(patch.status))
          throw invalid('status', 'Statut inconnu.');
        f.status = patch.status;
        if (patch.status === 'resolved' && !f.resolved_at) f.resolved_at = new Date().toISOString();
      }
      if (patch.assigned_to !== undefined) {
        if (patch.assigned_to !== null && !ADMINS.some((a) => a.id === patch.assigned_to))
          throw invalid('assigned_to', 'Administrateur inconnu.');
        f.assigned_to = patch.assigned_to;
      }
      return toFeedback(f);
    },
    async adminReplyFeedback(id, input, idempotencyKey) {
      const s = requireAdmin();
      await ctx.delay();
      const f = feedbacks.find((x) => x.id === id);
      if (!f) throw notFound();
      if (idempotencyKey) {
        const dup = f.replies.find((r) => (r as FeedbackReply & { key?: string }).key === idempotencyKey);
        if (dup) return dup;
      }
      between('body', input.body, 5, 5000, 'La réponse');
      const now = new Date().toISOString();
      const reply: FeedbackReply & { key?: string } = {
        id: next(),
        author: { id: ADMINS.find((a) => s.first_name === a.name.split(' ')[0])?.id ?? 1, name: `${s.first_name} ${s.last_name}`.trim() },
        body: input.body.trim(),
        is_internal: input.is_internal,
        sent_at: input.is_internal ? null : now,
        created_at: now,
        key: idempotencyKey,
      };
      f.replies.push(reply);
      return reply;
    },

    /* ----- Devis ----- */
    async createQuoteRequest(input, idempotencyKey) {
      await ctx.delay();
      const message = 'Votre demande de devis a bien été reçue. Conservez ce numéro de référence.';
      if (input.company_website) return { reference: ref('DEV', ++quoteSeq), message };
      const dup = quoteKeys.get(idempotencyKey);
      if (dup) return { reference: dup.reference, message };
      guardPublic(input);
      need('first_name', input.first_name, 'Le prénom');
      need('last_name', input.last_name, 'Le nom');
      emailOk(input.email);
      need('phone', input.phone, 'Le téléphone');
      if (!serviceTypes.some((x) => x.id === input.service_type_id)) throw invalid('service_type_id', 'Choisissez un service.');
      if (!cities.some((c) => c.id === input.city_id)) throw invalid('city_id', 'Choisissez une ville.');
      between('description', input.description, 20, 3000, 'La description');
      const slugs = input.provider_slugs ?? [];
      if (slugs.length > 5) throw invalid('provider_slugs', 'Vous pouvez choisir 5 prestataires au maximum.');
      if (slugs.some((x) => providerIndex(x) < 0)) throw invalid('provider_slugs', 'Un des prestataires est introuvable.');
      const rec = addQuote({
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        company_name: input.company_name?.trim() || null,
        service_type_id: input.service_type_id,
        city_id: input.city_id,
        district_id: input.district_id ?? null,
        description: input.description.trim(),
        desired_start_date: input.desired_start_date || null,
        budget_range: input.budget_range?.trim() || null,
        status: slugs.length ? 'sent' : 'new',
        created_at: new Date().toISOString(),
        recipients: slugs.map((x) => recipient(x, 'sent', { sent_at: new Date().toISOString() })),
      });
      quoteKeys.set(idempotencyKey, rec);
      return { reference: rec.reference, message };
    },
    async listMyQuotes(query = {}) {
      const s = ctx.requireSession();
      await ctx.delay();
      if (ownedIndexes(s).length === 0) throw forbidden('Cette page est réservée aux propriétaires de fiches.');
      const list: ProviderQuote[] = [];
      for (const q of quotes) {
        for (const r of q.recipients) {
          if (ownsSlug(s, r.providerSlug) && (!query.status || r.status === query.status))
            list.push(toProviderQuote(q, r));
        }
      }
      list.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
      return ctx.paginate(list, query.page);
    },
    async getMyQuote(id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const { q, r } = myRecipient(s, id);
      if (r.status === 'sent') {
        r.status = 'viewed';
        r.viewed_at = new Date().toISOString();
      }
      return toProviderQuote(q, r);
    },
    async replyToQuote(id, input) {
      const s = ctx.requireSession();
      await ctx.delay();
      const { q, r } = myRecipient(s, id);
      between('message', input.message, 10, 3000, 'Le message');
      if (input.quoted_amount != null && (!Number.isInteger(input.quoted_amount) || input.quoted_amount < 0))
        throw invalid('quoted_amount', 'Le montant doit être un nombre entier de FCFA.');
      if (r.status === 'replied') throw conflict('Vous avez déjà répondu à cette demande.');
      r.status = 'replied';
      r.replied_at = new Date().toISOString();
      r.viewed_at = r.viewed_at ?? r.replied_at;
      r.response_message = input.message.trim();
      r.quoted_amount = input.quoted_amount ?? null;
      q.status = 'answered';
    },
    async declineQuote(id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const { r } = myRecipient(s, id);
      if (r.status === 'replied') throw conflict('Vous avez déjà répondu à cette demande.');
      r.status = 'declined';
      r.viewed_at = r.viewed_at ?? new Date().toISOString();
    },
    async adminListQuotes(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const list = quotes
        .filter((x) => !query.status || x.status === query.status)
        .filter(
          (x) =>
            !q ||
            x.reference.toLowerCase().includes(q) ||
            `${x.first_name} ${x.last_name}`.toLowerCase().includes(q) ||
            x.email.toLowerCase().includes(q),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toQuoteRow);
      return ctx.paginate(list, query.page);
    },
    async adminGetQuote(id) {
      requireAdmin();
      await ctx.delay();
      const q = quotes.find((x) => x.id === id);
      if (!q) throw notFound();
      return toAdminQuote(q);
    },
    async adminDispatchQuote(id, providerIds) {
      requireAdmin();
      await ctx.delay();
      const q = quotes.find((x) => x.id === id);
      if (!q) throw notFound();
      if (providerIds.length < 1 || providerIds.length > 5)
        throw invalid('provider_ids', 'Choisissez entre 1 et 5 prestataires.');
      for (const pid of providerIds) {
        const p = providers[pid - 1];
        if (!p) throw invalid('provider_ids', 'Un des prestataires est introuvable.');
        if (!q.recipients.some((r) => r.providerSlug === p.slug)) q.recipients.push(recipient(p.slug, 'sent', { sent_at: new Date().toISOString() }));
      }
      if (q.status === 'new') q.status = 'sent';
      return toAdminQuote(q);
    },
    async adminUpdateQuoteStatus(id, status) {
      requireAdmin();
      await ctx.delay();
      const q = quotes.find((x) => x.id === id);
      if (!q) throw notFound();
      if (!['new', 'sent', 'answered', 'closed', 'cancelled'].includes(status)) throw invalid('status', 'Statut inconnu.');
      q.status = status;
    },

    /* ----- Contact ----- */
    async sendContact(input, idempotencyKey) {
      await ctx.delay();
      const ok = 'Merci, votre message a bien été envoyé.';
      if (input.company_website) return ok;
      if (contactKeys.has(idempotencyKey)) return ok;
      guardPublic(input);
      need('name', input.name, 'Le nom');
      emailOk(input.email);
      need('subject', input.subject, 'L’objet');
      if (input.subject.length > 200) throw invalid('subject', 'L’objet ne doit pas dépasser 200 caractères.');
      between('message', input.message, 10, 5000, 'Le message');
      const id = ++messageSeq;
      messages.unshift({
        id,
        name: input.name.trim(),
        email: input.email.trim(),
        subject: input.subject.trim(),
        message: input.message.trim(),
        status: 'new',
        handled_by: null,
        handled_at: null,
        created_at: new Date().toISOString(),
      });
      contactKeys.set(idempotencyKey, String(id));
      return ok;
    },
    async adminListContactMessages(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const status = query.status ?? 'new';
      const list = messages
        .filter((m) => m.status === status)
        .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ key, ...m }) => {
          void key;
          return m;
        });
      return ctx.paginate(list, query.page);
    },
    async adminUpdateContactMessage(id, status: ContactStatus) {
      const s = requireAdmin();
      await ctx.delay();
      const m = messages.find((x) => x.id === id);
      if (!m) throw notFound();
      if (!['new', 'read', 'answered', 'archived'].includes(status)) throw invalid('status', 'Statut inconnu.');
      m.status = status;
      m.handled_by = { id: 1, name: `${s.first_name} ${s.last_name}`.trim() };
      m.handled_at = new Date().toISOString();
    },
    async adminReplyContactMessage(id, body) {
      const s = requireAdmin();
      await ctx.delay();
      const m = messages.find((x) => x.id === id);
      if (!m) throw notFound();
      between('body', body, 5, 5000, 'La réponse');
      m.status = 'answered';
      m.handled_by = { id: 1, name: `${s.first_name} ${s.last_name}`.trim() };
      m.handled_at = new Date().toISOString();
    },
  };
}

/** Référence de démonstration du suivi « Dis-moi tout » (e-mail : awa.demo@example.test). */
export const DEMO_FEEDBACK_REFERENCE = 'DMT-2026-000101';
