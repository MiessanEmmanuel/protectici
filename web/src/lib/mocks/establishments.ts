import { ApiError } from '../api/errors';
import type { Api } from '../api/endpoints';
import type {
  AdminAuditLog,
  AdminEstablishment,
  AdminEstablishmentRow,
  AdminNotification,
  AdminReferenceItem,
  AdminUser,
  ChangeRequest,
  EstablishmentDocument,
  EstablishmentMedia,
  EstablishmentStatus,
  EstablishmentType,
  Paginated,
  ReferenceResource,
  Role,
} from '../api/types';
import { stateForces } from './forces';
import { providers } from './providers';
import { cities, companyTypes, procedureTypes, serviceTypes, slugify, stateForceTypes } from './reference';

/**
 * Données et logique FICTIVES de la vague A (établissements, espace prestataire, administration).
 * Tout est en mémoire (rechargement de la page = remise à zéro). Aucune donnée réelle.
 * Comptes : e-mail commençant par « prestataire » = propriétaire de 2 fiches (une rejetée avec
 * motif, une en attente) ; « admin » = administrateur (voir mock-api.ts).
 */

export type WaveAApi = Pick<
  Api,
  | 'createEstablishment'
  | 'listMyEstablishments'
  | 'getMyEstablishment'
  | 'updateMyEstablishment'
  | 'createChangeRequest'
  | 'cancelChangeRequest'
  | 'uploadDocument'
  | 'deleteDocument'
  | 'uploadMedia'
  | 'deleteMedia'
  | 'resubmitEstablishment'
  | 'adminDashboard'
  | 'adminListEstablishments'
  | 'adminGetEstablishment'
  | 'adminUpdateEstablishment'
  | 'adminEstablishmentAction'
  | 'adminDeleteEstablishment'
  | 'adminDownloadDocument'
  | 'adminListChangeRequests'
  | 'adminApproveChangeRequest'
  | 'adminRejectChangeRequest'
  | 'adminListUsers'
  | 'adminUpdateUser'
  | 'adminAnonymizeUser'
  | 'adminListReference'
  | 'adminCreateReference'
  | 'adminUpdateReference'
  | 'adminDeleteReference'
  | 'adminListAuditLogs'
  | 'adminListNotifications'
  | 'adminMarkNotificationRead'
>;

export interface MockSession {
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  two_factor: boolean;
  verified: boolean;
}

export interface MockContext {
  /** Lève 401 si anonyme. */
  requireSession(): MockSession;
  delay(ms?: number): Promise<void>;
  paginate<T>(items: T[], page?: number, perPage?: number): Paginated<T>;
}

const NOW = '2026-10-07T09:00:00Z';
/** Sentinelle : fiche appartenant à tout compte dont l'e-mail commence par « prestataire ». */
const DEMO_OWNER = '*prestataire*';

interface Rec extends AdminEstablishment {
  ownerKey: string;
}

const SENSITIVE: Record<EstablishmentType, string[]> = {
  provider: ['name', 'rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number'],
  state_force: ['name', 'force_type_id'],
};

const forbidden = (m = "Vous n'avez pas l'autorisation d'effectuer cette action.") =>
  new ApiError(403, m);
const notFound = () => new ApiError(404, 'Cette page ou cette ressource est introuvable.');
const invalid = (field: string, message: string) =>
  new ApiError(422, 'Certaines informations sont invalides.', { [field]: [message] });

function ids(list: { id: number; slug: string }[], slugs: string[]): number[] {
  return slugs.map((s) => list.find((x) => x.slug === s)?.id).filter((x): x is number => !!x);
}

function baseRec(
  type: EstablishmentType,
  id: number,
  slug: string,
  name: string,
  status: EstablishmentStatus,
  ownerKey: string,
  owner: Rec['owner'],
): Rec {
  return {
    ownerKey,
    type,
    id,
    slug,
    name,
    status,
    rejection_reason: null,
    is_visible: status === 'approved',
    is_verified: false,
    is_featured: false,
    submitted_at: NOW,
    reviewed_at: status === 'approved' ? NOW : null,
    pending_change_requests: 0,
    description: null,
    phone: null,
    phone_alt: null,
    emergency_phone: null,
    email: null,
    address: null,
    city_id: null,
    district_id: null,
    geo_description: null,
    plus_code: null,
    lat: null,
    lng: null,
    submitter_role: 'manager',
    is_in_service: true,
    executives: [],
    media: [],
    documents: [],
    change_requests: [],
    owner,
    views_count: 0,
    reviewed_by: status === 'approved' ? { id: 1, name: 'Admin Démo' } : null,
    audit: [],
  };
}

function cityIds(citySlug: string, districtSlug: string | null) {
  const city = cities.find((c) => c.slug === citySlug);
  const district = districtSlug ? city?.districts.find((d) => d.slug === districtSlug) : null;
  return { city_id: city?.id ?? null, district_id: district?.id ?? null };
}

function seedRecords(): Rec[] {
  const out: Rec[] = [];
  providers.slice(0, 6).forEach((p, i) => {
    const owner = {
      id: 100 + i,
      first_name: 'Responsable',
      last_name: `Fiche ${i + 1}`,
      email: `proprietaire${i + 1}@example.test`,
      phone: null,
    };
    const r = baseRec('provider', i + 1, p.slug, p.name, 'approved', owner.email, owner);
    Object.assign(r, {
      ...cityIds(p.city.slug, p.district?.slug ?? null),
      description: p.description,
      phone: p.phone,
      emergency_phone: p.emergency_phone,
      email: p.email,
      website_url: p.website_url,
      address: p.address,
      geo_description: p.geo_description,
      lat: p.lat,
      lng: p.lng,
      price_from: p.price_from,
      is_verified: p.is_verified,
      is_featured: p.is_featured,
      views_count: p.views_count,
      company_type_ids: p.company_types.map((c) => c.id),
      service_type_ids: ids(serviceTypes, p.services.map((s) => s.slug)),
      rccm: p.legal.rccm,
      legal_form: p.legal.legal_form,
      share_capital: p.legal.share_capital,
      corporate_purpose: p.legal.corporate_purpose,
      approval_number: p.legal.approval_number,
      executives: p.executives.map((e, k) => ({
        id: i * 10 + k + 1,
        full_name: e.full_name,
        position: e.position,
        position_label: e.position_label,
        is_visible: true,
      })),
    });
    r.audit = [{ event: 'establishment.approved', user: { name: 'Admin Démo' }, created_at: NOW }];
    out.push(r);
  });
  stateForces.slice(0, 3).forEach((f, i) => {
    const owner = {
      id: 200 + i,
      first_name: 'Commissaire',
      last_name: `Démo ${i + 1}`,
      email: `administration${i + 1}@example.test`,
      phone: null,
    };
    const r = baseRec('state_force', i + 1, f.slug, f.name, 'approved', owner.email, owner);
    Object.assign(r, {
      ...cityIds(f.city.slug, f.district?.slug ?? null),
      description: f.description,
      phone: f.phone,
      emergency_phone: f.emergency_phone,
      email: f.email,
      address: f.address,
      lat: f.lat,
      lng: f.lng,
      force_type_id: f.force_type.id,
      procedure_type_ids: ids(procedureTypes, f.procedures.map((p) => p.slug)),
      opening_hours: f.opening_hours,
      is_open_24h: f.is_open_24h,
    });
    out.push(r);
  });

  const demo = {
    id: 3,
    first_name: 'Yao',
    last_name: 'Prestataire',
    email: 'prestataire@example.test',
    phone: '+2250700000003',
  };
  const pending = baseRec(
    'provider',
    101,
    'garde-lagune-securite',
    'Garde Lagune Sécurité',
    'pending',
    DEMO_OWNER,
    demo,
  );
  Object.assign(pending, {
    ...cityIds('abidjan', 'marcory'),
    description: 'Société de gardiennage de proximité pour résidences et commerces de Marcory.',
    phone: '+2252720000301',
    email: 'contact@garde-lagune.example.test',
    company_type_ids: [1],
    service_type_ids: ids(serviceTypes, ['gardiennage-non-arme', 'videosurveillance']),
    rccm: 'CI-ABJ-2024-B-00301',
    legal_form: 'SARL',
    share_capital: 5000000,
    corporate_purpose: 'Gardiennage et surveillance de sites.',
    approval_number: 'AGR-DEMO-0301',
    lat: 5.3,
    lng: -3.99,
    submitted_at: '2026-10-05T10:00:00Z',
    pending_change_requests: 0,
    executives: [
      { id: 901, full_name: 'Yao Prestataire', position: 'general_manager', position_label: null, is_visible: true },
    ],
    documents: [
      {
        id: 801,
        type: 'rccm_extract',
        original_name: 'extrait-rccm.pdf',
        size_bytes: 184320,
        uploaded_at: '2026-10-05T10:05:00Z',
        verified_at: null,
      },
    ],
  });
  pending.audit = [
    { event: 'establishment.submitted', user: { name: 'Yao Prestataire' }, created_at: '2026-10-05T10:00:00Z' },
  ];
  const rejected = baseRec(
    'provider',
    102,
    'phoenix-protection',
    'Phoenix Protection',
    'rejected',
    DEMO_OWNER,
    demo,
  );
  Object.assign(rejected, {
    ...cityIds('bouake', null),
    description: 'Protection de sites industriels.',
    phone: '+2252720000302',
    company_type_ids: [1],
    service_type_ids: ids(serviceTypes, ['gardiennage-arme']),
    rejection_reason:
      "Le numéro d'agrément fourni est illisible. Merci de joindre un justificatif lisible puis de soumettre à nouveau la fiche.",
    submitted_at: '2026-10-01T08:00:00Z',
    reviewed_at: '2026-10-03T08:00:00Z',
    reviewed_by: { id: 1, name: 'Admin Démo' },
    approval_number: 'AGR-DEMO-0302',
    rccm: 'CI-BKE-2023-B-00302',
    legal_form: 'SA',
    share_capital: 20000000,
    corporate_purpose: 'Protection de sites industriels.',
  });
  rejected.audit = [
    { event: 'establishment.rejected', user: { name: 'Admin Démo' }, created_at: '2026-10-03T08:00:00Z' },
  ];
  out.push(pending, rejected);

  const other = {
    id: 110,
    first_name: 'Fatou',
    last_name: 'Diabaté',
    email: 'fatou.diabate@example.test',
    phone: null,
  };
  const p3 = baseRec('provider', 103, 'cobra-gardiennage', 'Cobra Gardiennage', 'pending', other.email, other);
  Object.assign(p3, {
    ...cityIds('yamoussoukro', null),
    phone: '+2252720000303',
    company_type_ids: [1],
    service_type_ids: ids(serviceTypes, ['gardiennage-non-arme']),
    submitted_at: '2026-10-06T14:00:00Z',
  });
  const s2 = baseRec('state_force', 101, 'poste-de-police-de-koumassi', 'Poste de police de Koumassi', 'pending', other.email, other);
  Object.assign(s2, {
    ...cityIds('abidjan', 'koumassi'),
    phone: '+2252720000304',
    force_type_id: stateForceTypes[0]!.id,
    procedure_type_ids: [1, 2],
    submitted_at: '2026-10-06T15:00:00Z',
  });
  out.push(p3, s2);
  return out;
}

function seedUsers(): AdminUser[] {
  const u = (
    id: number,
    first_name: string,
    last_name: string,
    email: string,
    role: Role,
    extra: Partial<AdminUser> = {},
  ): AdminUser => ({
    id,
    first_name,
    last_name,
    email,
    phone: null,
    role,
    is_active: true,
    email_verified: true,
    two_factor_enabled: role === 'admin' || role === 'editor',
    last_login_at: '2026-10-06T18:00:00Z',
    created_at: '2026-09-01T09:00:00Z',
    establishments_count: 0,
    ...extra,
  });
  return [
    u(1, 'Admin', 'Démo', 'admin@example.test', 'admin'),
    u(2, 'Salimata', 'Ouattara', 'admin2@example.test', 'admin'),
    u(3, 'Yao', 'Prestataire', 'prestataire@example.test', 'provider', { establishments_count: 2 }),
    u(4, 'Éric', 'Éditeur', 'editor@example.test', 'editor'),
    u(5, 'Awa', 'Koné', 'awa.kone@example.test', 'user'),
    u(6, 'Moussa', 'Traoré', 'moussa.traore@example.test', 'user'),
    u(7, 'Fatou', 'Diabaté', 'fatou.diabate@example.test', 'user', { establishments_count: 2 }),
    u(8, 'Jean', 'Bamba', 'jean.bamba@example.test', 'user', { is_active: false }),
    u(9, 'Mariam', 'Coulibaly', 'mariam.coulibaly@example.test', 'user', { email_verified: false }),
  ];
}

const REF_LABELS: Record<ReferenceResource, string> = {
  cities: 'cities',
  districts: 'districts',
  'company-types': 'company_types',
  'service-types': 'service_types',
  'state-force-types': 'state_force_types',
  'procedure-types': 'procedure_types',
  'feedback-topics': 'feedback_topics',
  'post-categories': 'post_categories',
};

function seedReference(): Record<ReferenceResource, AdminReferenceItem[]> {
  const opts = (list: { id: number; name: string; slug: string }[]): AdminReferenceItem[] =>
    list.map((o, i) => ({ id: o.id, name: o.name, slug: o.slug, sort_order: i + 1, is_visible: true }));
  const named = (names: string[]): AdminReferenceItem[] =>
    names.map((name, i) => ({ id: i + 1, name, slug: slugify(name), sort_order: i + 1, is_visible: true }));
  const districts = cities.flatMap((c) =>
    c.districts.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      sort_order: d.id,
      is_visible: true,
      city_id: c.id,
      parent_id: d.parent_id,
    })),
  );
  return {
    cities: cities.map((c, i) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sort_order: i + 1,
      is_visible: true,
      lat: c.lat,
      lng: c.lng,
    })),
    districts,
    'company-types': opts(companyTypes),
    'service-types': opts(serviceTypes),
    'state-force-types': opts(stateForceTypes),
    'procedure-types': opts(procedureTypes),
    'feedback-topics': named([
      'Courtoisie',
      "Rapidité d'intervention",
      'Disponibilité',
      'Ponctualité',
      'Tenue',
      'Professionnalisme',
      'Facturation et SAV',
      'Autres',
    ]),
    'post-categories': named([
      'Actualités',
      'Anti-intrusion',
      'Cybercriminalité',
      'Domotique',
      'Emploi',
      'Formation',
      'Sécurité incendie',
    ]),
  };
}

function seedAudit(): AdminAuditLog[] {
  const events: [string, string, string, number][] = [
    ['login.success', 'Admin Démo', 'user', 1],
    ['establishment.approved', 'Admin Démo', 'provider', 1],
    ['establishment.approved', 'Admin Démo', 'provider', 2],
    ['establishment.rejected', 'Admin Démo', 'provider', 102],
    ['role_changed', 'Admin Démo', 'user', 4],
    ['document.downloaded', 'Admin Démo', 'provider', 101],
    ['establishment.submitted', 'Yao Prestataire', 'provider', 101],
    ['change_request.created', 'Fatou Diabaté', 'provider', 103],
  ];
  return events.map(([event, name, auditable_type, auditable_id], i) => ({
    id: i + 1,
    event,
    user: { id: 1, name },
    auditable_type,
    auditable_id,
    old_values: null,
    new_values: event === 'role_changed' ? { role: 'editor' } : null,
    ip_address: '127.0.0.1',
    created_at: `2026-10-0${Math.min(i + 1, 7)}T10:${String(i * 7).padStart(2, '0')}:00Z`,
  }));
}

const placeholderImage = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#d2e2f7"/><text x="160" y="95" font-size="16" text-anchor="middle" fill="#022a63">${label.replace(/[<>&"]/g, '')}</text></svg>`,
  )}`;

export function createWaveAMocks(ctx: MockContext): WaveAApi {
  const records: Rec[] = seedRecords();
  const users: AdminUser[] = seedUsers();
  const reference = seedReference();
  const audit: AdminAuditLog[] = seedAudit();
  const notifications: AdminNotification[] = [
    { id: 1, type: 'establishment.submitted', message: 'Nouvelle inscription : Cobra Gardiennage', read_at: null, created_at: '2026-10-06T14:00:00Z' },
    { id: 2, type: 'establishment.submitted', message: 'Nouvelle inscription : Poste de police de Koumassi', read_at: null, created_at: '2026-10-06T15:00:00Z' },
    { id: 3, type: 'document.uploaded', message: 'Nouveau justificatif : Garde Lagune Sécurité', read_at: '2026-10-06T16:00:00Z', created_at: '2026-10-05T10:05:00Z' },
  ];
  const idempotent = new Map<string, Rec>();
  let seq = 1000;
  const next = () => ++seq;

  const isDemoUser = (s: MockSession) => s.email.toLowerCase().startsWith('prestataire');
  const owns = (r: Rec, s: MockSession) =>
    r.ownerKey === DEMO_OWNER ? isDemoUser(s) : r.ownerKey.toLowerCase() === s.email.toLowerCase();

  function requireAdmin(): MockSession {
    const s = ctx.requireSession();
    if (s.role !== 'admin' || !s.two_factor) throw forbidden();
    return s;
  }

  function findMine(type: EstablishmentType, slug: string, s: MockSession): Rec {
    const r = records.find((x) => x.type === type && x.slug === slug && owns(x, s));
    if (!r) throw notFound(); // accès à la fiche d'autrui : 404
    return r;
  }
  function findAdmin(type: EstablishmentType, id: number): Rec {
    const r = records.find((x) => x.type === type && x.id === id);
    if (!r) throw notFound();
    return r;
  }
  function writable(r: Rec) {
    if (r.status === 'suspended')
      throw forbidden('Cette fiche est suspendue : elle ne peut plus être modifiée.');
  }
  function log(event: string, r: Rec, who: string) {
    const entry = { event, user: { name: who }, created_at: new Date().toISOString() };
    r.audit = [entry, ...r.audit].slice(0, 20);
    audit.unshift({
      id: next(),
      event,
      user: { id: 1, name: who },
      auditable_type: r.type,
      auditable_id: r.id,
      old_values: null,
      new_values: null,
      ip_address: '127.0.0.1',
      created_at: entry.created_at,
    });
  }
  const refresh = (r: Rec) => {
    r.pending_change_requests = r.change_requests.filter((c) => c.status === 'pending').length;
    return r;
  };
  const strip = (r: Rec): Rec => {
    const copy = structuredClone(refresh(r)) as Rec;
    return copy;
  };
  const toMine = (r: Rec): AdminEstablishment => {
    const { ownerKey, ...rest } = strip(r);
    void ownerKey;
    return rest;
  };
  const toRow = (r: Rec): AdminEstablishmentRow => ({
    type: r.type,
    id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    is_visible: r.is_visible,
    is_verified: r.is_verified,
    is_featured: r.is_featured,
    city: { name: cities.find((c) => c.id === r.city_id)?.name ?? '—' },
    owner: { id: r.owner.id, name: `${r.owner.first_name} ${r.owner.last_name}`, email: r.owner.email },
    submitted_at: r.submitted_at,
    reviewed_at: r.reviewed_at,
  });

  function applyPatch(r: Rec, patch: Record<string, unknown>) {
    const target = r as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'executives' && Array.isArray(value)) {
        r.executives = value.map((e, i) => ({
          id: next() + i,
          full_name: String((e as { full_name?: string }).full_name ?? ''),
          position: (e as { position: Rec['executives'][number]['position'] }).position,
          position_label: ((e as { position_label?: string | null }).position_label ?? null) as string | null,
          is_visible: Boolean((e as { is_visible?: boolean }).is_visible),
        }));
      } else if (key !== 'id' && key !== 'status') {
        target[key] = value;
      }
    }
  }

  function validateCommon(patch: Record<string, unknown>) {
    for (const f of ['lat', 'lng'] as const) {
      const v = patch[f];
      if (v !== undefined && v !== null) {
        const lim = f === 'lat' ? 90 : 180;
        if (typeof v !== 'number' || Math.abs(v) > lim)
          throw invalid(f, 'La coordonnée est hors limites.');
      }
    }
    for (const f of ['website_url', 'facebook_url', 'instagram_url', 'twitter_url', 'linkedin_url']) {
      const v = patch[f];
      if (typeof v === 'string' && v !== '' && !/^https?:\/\//i.test(v))
        throw invalid(f, "L'adresse doit commencer par http:// ou https://.");
    }
  }

  const base: WaveAApi = {
    async createEstablishment(input, key) {
      const s = ctx.requireSession();
      await ctx.delay(200);
      if (!s.verified)
        throw forbidden('Veuillez vérifier votre adresse e-mail avant d’inscrire un établissement.');
      const known = idempotent.get(`${s.email}:${key}`);
      if (known) return toMine(known);
      if (!input.name?.trim()) throw invalid('name', 'Le nom est obligatoire.');
      if (!input.city_id) throw invalid('city_id', 'La ville est obligatoire.');
      if (input.consent !== true) throw invalid('consent', 'Le consentement est obligatoire.');
      if (input.type === 'provider') {
        if (!input.company_type_ids?.length)
          throw invalid('company_type_ids', 'Choisissez au moins un type d’entreprise.');
        if (!input.service_type_ids?.length)
          throw invalid('service_type_ids', 'Choisissez au moins un service.');
        if (!input.phone) throw invalid('phone', 'Le téléphone est obligatoire.');
      } else if (!input.force_type_id) {
        throw invalid('force_type_id', 'Le type de structure est obligatoire.');
      }
      validateCommon(input as unknown as Record<string, unknown>);
      const id = next();
      let slug = slugify(input.name);
      while (records.some((r) => r.type === input.type && r.slug === slug)) slug = `${slug}-${id}`;
      const owner = {
        id: 1,
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email,
        phone: null,
      };
      const rec = baseRec(input.type, id, slug, input.name.trim(), 'pending', isDemoUser(s) ? DEMO_OWNER : s.email, owner);
      const { type, consent, executives, ...fields } = input as typeof input & { executives?: unknown };
      void type;
      void consent;
      applyPatch(rec, fields as Record<string, unknown>);
      if (Array.isArray(executives)) applyPatch(rec, { executives });
      rec.submitted_at = new Date().toISOString();
      log('establishment.submitted', rec, `${s.first_name} ${s.last_name}`);
      notifications.unshift({
        id: next(),
        type: 'establishment.submitted',
        message: `Nouvelle inscription : ${rec.name}`,
        read_at: null,
        created_at: rec.submitted_at,
      });
      records.push(rec);
      idempotent.set(`${s.email}:${key}`, rec);
      return toMine(rec);
    },
    async listMyEstablishments(page) {
      const s = ctx.requireSession();
      await ctx.delay();
      const mine = records
        .filter((r) => owns(r, s))
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
        .map((r) => {
          const m = toMine(r);
          return {
            type: m.type,
            slug: m.slug,
            name: m.name,
            status: m.status,
            rejection_reason: m.rejection_reason,
            is_visible: m.is_visible,
            is_verified: m.is_verified,
            submitted_at: m.submitted_at,
            reviewed_at: m.reviewed_at,
            pending_change_requests: m.pending_change_requests,
          };
        });
      return ctx.paginate(mine, page, 12);
    },
    async getMyEstablishment(type, slug) {
      const s = ctx.requireSession();
      await ctx.delay();
      return toMine(findMine(type, slug, s));
    },
    async updateMyEstablishment(type, slug, patch) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      writable(r);
      for (const f of SENSITIVE[type]) {
        if (f in patch) throw invalid(f, 'Ce champ nécessite une demande de modification.');
      }
      validateCommon(patch);
      applyPatch(r, patch);
      return toMine(r);
    },
    async createChangeRequest(type, slug, changes) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      writable(r);
      const entries = Object.entries(changes);
      if (!entries.length) throw invalid('changes', 'Indiquez au moins un champ à modifier.');
      for (const [f] of entries) {
        if (!SENSITIVE[type].includes(f)) throw invalid(`changes.${f}`, 'Ce champ ne nécessite pas de demande.');
      }
      if (r.change_requests.some((c) => c.status === 'pending'))
        throw new ApiError(409, 'Une demande de modification est déjà en attente.');
      const rec = r as unknown as Record<string, unknown>;
      const cr: ChangeRequest = {
        id: next(),
        changes: Object.fromEntries(entries.map(([f, v]) => [f, { old: rec[f] ?? null, new: v }])),
        status: 'pending',
        rejection_reason: null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
      };
      r.change_requests.unshift(cr);
      log('change_request.created', r, `${s.first_name} ${s.last_name}`);
      return structuredClone(cr);
    },
    async cancelChangeRequest(type, slug, id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      const idx = r.change_requests.findIndex((c) => c.id === id);
      if (idx < 0) throw notFound();
      if (r.change_requests[idx]!.status !== 'pending')
        throw new ApiError(409, 'Cette demande a déjà été traitée.');
      r.change_requests.splice(idx, 1);
    },
    async uploadDocument(type, slug, file, docType) {
      const s = ctx.requireSession();
      await ctx.delay(200);
      const r = findMine(type, slug, s);
      writable(r);
      if (file.size > 10 * 1024 * 1024) throw new ApiError(413, 'Le fichier dépasse 10 Mo.');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
        throw new ApiError(415, 'Format non accepté : PDF, JPEG ou PNG uniquement.');
      if (r.documents.length >= 5) throw invalid('file', 'Maximum 5 justificatifs par fiche.');
      const doc: EstablishmentDocument = {
        id: next(),
        type: docType,
        original_name: file.name,
        size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
        verified_at: null,
      };
      r.documents.push(doc);
      return { ...doc };
    },
    async deleteDocument(type, slug, id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      writable(r);
      r.documents = r.documents.filter((d) => d.id !== id);
    },
    async uploadMedia(type, slug, { file, collection, alt }) {
      const s = ctx.requireSession();
      await ctx.delay(200);
      const r = findMine(type, slug, s);
      writable(r);
      if (!alt.trim()) throw invalid('alt', 'Le texte alternatif est obligatoire.');
      if (file.size > 5 * 1024 * 1024) throw new ApiError(413, 'Le fichier dépasse 5 Mo.');
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))
        throw new ApiError(415, 'Format non accepté : JPEG, PNG, WebP ou AVIF uniquement.');
      const count = r.media.filter((m) => m.collection === collection).length;
      const max = collection === 'gallery' ? 10 : 1;
      if (count >= max)
        throw invalid('collection', collection === 'gallery' ? 'Maximum 10 images de galerie.' : 'Une seule image est autorisée : supprimez l’existante.');
      const m: EstablishmentMedia = { id: next(), collection, url: placeholderImage(collection), alt };
      r.media.push(m);
      return { ...m };
    },
    async deleteMedia(type, slug, id) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      writable(r);
      r.media = r.media.filter((m) => m.id !== id);
    },
    async resubmitEstablishment(type, slug) {
      const s = ctx.requireSession();
      await ctx.delay();
      const r = findMine(type, slug, s);
      if (r.status === 'pending') return; // rejeu : sans effet
      if (r.status !== 'rejected') throw new ApiError(409, 'Seule une fiche rejetée peut être soumise à nouveau.');
      r.status = 'pending';
      r.rejection_reason = null;
      r.submitted_at = new Date().toISOString();
      log('establishment.resubmitted', r, `${s.first_name} ${s.last_name}`);
    },

    /* ----------------------------- Administration ----------------------------- */
    async adminDashboard() {
      requireAdmin();
      await ctx.delay();
      return {
        pending_reviews: 0,
        open_review_reports: 0,
        new_feedbacks: 0,
        new_quote_requests: 0,
        new_contact_messages: 0,
        pending_providers: records.filter((r) => r.type === 'provider' && r.status === 'pending').length,
        pending_state_forces: records.filter((r) => r.type === 'state_force' && r.status === 'pending').length,
        pending_change_requests: records.reduce((n, r) => n + r.change_requests.filter((c) => c.status === 'pending').length, 0),
        users_total: users.length,
        providers_approved: records.filter((r) => r.type === 'provider' && r.status === 'approved').length,
        state_forces_approved: records.filter((r) => r.type === 'state_force' && r.status === 'approved').length,
        recent_audit: audit.slice(0, 10),
      };
    },
    async adminListEstablishments(query = {}) {
      requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      let list = records
        .filter((r) => !query.type || r.type === query.type)
        .filter((r) => !query.status || r.status === query.status)
        .filter((r) => !q || r.name.toLowerCase().includes(q) || r.owner.email.toLowerCase().includes(q));
      list = list.sort((a, b) =>
        query.sort === 'name' ? a.name.localeCompare(b.name, 'fr') : b.submitted_at.localeCompare(a.submitted_at),
      );
      return ctx.paginate(list.map(toRow), query.page, query.per_page ?? 15);
    },
    async adminGetEstablishment(type, id) {
      requireAdmin();
      await ctx.delay();
      const { ownerKey, ...rest } = strip(findAdmin(type, id));
      void ownerKey;
      return rest;
    },
    async adminUpdateEstablishment(type, id, patch) {
      requireAdmin();
      await ctx.delay();
      const r = findAdmin(type, id);
      validateCommon(patch);
      if (typeof patch.name === 'string' && !patch.name.trim()) throw invalid('name', 'Le nom est obligatoire.');
      applyPatch(r, patch);
      log('establishment.updated', r, 'Admin Démo');
      return toMine(r);
    },
    async adminEstablishmentAction(type, id, action, reason) {
      requireAdmin();
      await ctx.delay();
      const r = findAdmin(type, id);
      const who = 'Admin Démo';
      switch (action) {
        case 'approve':
          if (r.status === 'approved') return; // idempotent : pas de nouvel e-mail ni d'audit
          r.status = 'approved';
          r.is_visible = true;
          r.rejection_reason = null;
          r.reviewed_at = new Date().toISOString();
          r.reviewed_by = { id: 1, name: who };
          log('establishment.approved', r, who);
          return;
        case 'reject':
          if ((reason ?? '').trim().length < 10)
            throw invalid('reason', 'Le motif doit contenir au moins 10 caractères.');
          if (r.status === 'rejected') return;
          r.status = 'rejected';
          r.is_visible = false;
          r.rejection_reason = reason!.trim();
          r.reviewed_at = new Date().toISOString();
          r.reviewed_by = { id: 1, name: who };
          log('establishment.rejected', r, who);
          return;
        case 'suspend':
          if (!(reason ?? '').trim()) throw invalid('reason', 'Le motif est obligatoire.');
          if (r.status === 'suspended') return;
          r.status = 'suspended';
          r.is_visible = false;
          r.rejection_reason = reason!.trim();
          log('establishment.suspended', r, who);
          return;
        case 'restore':
          if (r.status !== 'suspended') return;
          r.status = 'approved';
          r.is_visible = true;
          r.rejection_reason = null;
          log('establishment.restored', r, who);
          return;
        case 'verify':
        case 'unverify':
          if (r.type !== 'provider') throw invalid('type', 'Seuls les prestataires peuvent être vérifiés.');
          if (r.is_verified === (action === 'verify')) return;
          r.is_verified = action === 'verify';
          log(`establishment.${action === 'verify' ? 'verified' : 'unverified'}`, r, who);
      }
    },
    async adminDeleteEstablishment(type, id, confirmName) {
      requireAdmin();
      await ctx.delay();
      const r = findAdmin(type, id);
      if (confirmName !== r.name) throw invalid('confirm_name', 'Le nom saisi ne correspond pas.');
      records.splice(records.indexOf(r), 1);
      log('establishment.deleted', r, 'Admin Démo');
    },
    async adminDownloadDocument(id) {
      requireAdmin();
      await ctx.delay();
      const doc = records.flatMap((r) => r.documents).find((d) => d.id === id);
      if (!doc) throw notFound();
      return new Blob([`Document de démonstration : ${doc.original_name}`], { type: 'text/plain' });
    },
    async adminListChangeRequests(query = {}) {
      requireAdmin();
      await ctx.delay();
      const status = query.status ?? 'pending';
      const rows = records.flatMap((r) =>
        r.change_requests
          .filter((c) => c.status === status)
          .map((c) => ({
            id: c.id,
            type: r.type,
            establishment: { id: r.id, name: r.name },
            changes: structuredClone(c.changes),
            status: c.status,
            created_at: c.created_at,
          })),
      );
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ctx.paginate(rows, query.page, 15);
    },
    async adminApproveChangeRequest(id) {
      requireAdmin();
      await ctx.delay();
      const r = records.find((x) => x.change_requests.some((c) => c.id === id));
      const cr = r?.change_requests.find((c) => c.id === id);
      if (!r || !cr) throw notFound();
      if (cr.status === 'approved') return; // idempotent
      if (cr.status === 'rejected') throw new ApiError(409, 'Cette demande a déjà été rejetée.');
      applyPatch(r, Object.fromEntries(Object.entries(cr.changes).map(([f, v]) => [f, v.new])));
      cr.status = 'approved';
      cr.reviewed_at = new Date().toISOString();
      log('change_request.approved', r, 'Admin Démo');
    },
    async adminRejectChangeRequest(id, reason) {
      requireAdmin();
      await ctx.delay();
      const r = records.find((x) => x.change_requests.some((c) => c.id === id));
      const cr = r?.change_requests.find((c) => c.id === id);
      if (!r || !cr) throw notFound();
      if (reason.trim().length < 10) throw invalid('reason', 'Le motif doit contenir au moins 10 caractères.');
      if (cr.status === 'rejected') return;
      if (cr.status === 'approved') throw new ApiError(409, 'Cette demande a déjà été approuvée.');
      cr.status = 'rejected';
      cr.rejection_reason = reason.trim();
      cr.reviewed_at = new Date().toISOString();
      log('change_request.rejected', r, 'Admin Démo');
    },
    async adminListUsers(query = {}) {
      const s = requireAdmin();
      await ctx.delay();
      const q = query.q?.trim().toLowerCase();
      const list = users
        .map((u) => (u.id === 1 ? { ...u, email: s.email, first_name: s.first_name, last_name: s.last_name } : u))
        .filter((u) => !query.role || u.role === query.role)
        .filter((u) => query.is_active === undefined || u.is_active === query.is_active)
        .filter(
          (u) =>
            !q ||
            `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q),
        );
      return ctx.paginate(structuredClone(list), query.page, 15);
    },
    async adminUpdateUser(id, patch) {
      requireAdmin();
      await ctx.delay();
      const u = users.find((x) => x.id === id);
      if (!u) throw notFound();
      if (id === 1 && ((patch.role && patch.role !== 'admin') || patch.is_active === false))
        throw invalid('role', 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.');
      if (
        u.role === 'admin' &&
        ((patch.role && patch.role !== 'admin') || patch.is_active === false) &&
        users.filter((x) => x.role === 'admin' && x.is_active).length <= 1
      )
        throw invalid('role', 'Impossible de retirer le dernier administrateur actif.');
      if (patch.role && patch.role !== u.role) {
        audit.unshift({
          id: next(),
          event: 'role_changed',
          user: { id: 1, name: 'Admin Démo' },
          auditable_type: 'user',
          auditable_id: u.id,
          old_values: { role: u.role },
          new_values: { role: patch.role },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString(),
        });
        u.role = patch.role;
        u.two_factor_enabled = u.role === 'admin' || u.role === 'editor' ? true : u.two_factor_enabled;
      }
      if (patch.is_active !== undefined) u.is_active = patch.is_active;
      return structuredClone(u);
    },
    async adminAnonymizeUser(id, confirmEmail) {
      const s = requireAdmin();
      await ctx.delay();
      const u = users.find((x) => x.id === id);
      if (!u) throw notFound();
      if (id === 1) throw invalid('confirm_email', 'Vous ne pouvez pas anonymiser votre propre compte.');
      const email = u.id === 1 ? s.email : u.email;
      if (confirmEmail !== email) throw invalid('confirm_email', 'L’adresse saisie ne correspond pas.');
      u.first_name = 'Anonyme';
      u.last_name = '';
      u.email = `anonyme-${u.id}@anonyme.invalid`;
      u.phone = null;
      u.is_active = false;
      u.role = 'user';
    },
    async adminListReference(resource, page) {
      requireAdmin();
      await ctx.delay();
      if (!REF_LABELS[resource]) throw notFound();
      return ctx.paginate(structuredClone(reference[resource]), page, 25);
    },
    async adminCreateReference(resource, input) {
      requireAdmin();
      await ctx.delay();
      const list = reference[resource];
      if (!list) throw notFound();
      if (!input.name?.trim()) throw invalid('name', 'Le nom est obligatoire.');
      if (resource === 'districts' && !input.city_id) throw invalid('city_id', 'La ville est obligatoire.');
      const item: AdminReferenceItem = {
        ...input,
        id: Math.max(0, ...list.map((x) => x.id)) + 1,
        name: input.name.trim(),
        slug: slugify(input.name),
        sort_order: input.sort_order ?? list.length + 1,
        is_visible: input.is_visible ?? true,
      };
      if (list.some((x) => x.slug === item.slug)) throw invalid('name', 'Cette valeur existe déjà.');
      list.push(item);
      return { ...item };
    },
    async adminUpdateReference(resource, id, input) {
      requireAdmin();
      await ctx.delay();
      const item = reference[resource]?.find((x) => x.id === id);
      if (!item) throw notFound();
      if (input.name !== undefined && !input.name.trim()) throw invalid('name', 'Le nom est obligatoire.');
      Object.assign(item, input, input.name ? { name: input.name.trim() } : {});
      return { ...item };
    },
    async adminDeleteReference(resource, id) {
      requireAdmin();
      await ctx.delay();
      const list = reference[resource];
      const idx = list?.findIndex((x) => x.id === id) ?? -1;
      if (idx < 0) throw notFound();
      // Simulation : les deux premières valeurs de chaque référentiel sont « utilisées ».
      if (idx < 2) throw new ApiError(409, 'Valeur utilisée, masquez-la plutôt.');
      list!.splice(idx, 1);
    },
    async adminListAuditLogs(query = {}) {
      requireAdmin();
      await ctx.delay();
      const list = audit
        .filter((a) => !query.event || a.event.includes(query.event))
        .filter((a) => !query.user_id || a.user?.id === query.user_id)
        .filter((a) => !query.auditable_type || a.auditable_type === query.auditable_type)
        .filter((a) => !query.from || a.created_at.slice(0, 10) >= query.from)
        .filter((a) => !query.to || a.created_at.slice(0, 10) <= query.to);
      return ctx.paginate(structuredClone(list), query.page, 20);
    },
    async adminListNotifications() {
      requireAdmin();
      await ctx.delay(60);
      return structuredClone(notifications);
    },
    async adminMarkNotificationRead(id) {
      requireAdmin();
      const n = notifications.find((x) => String(x.id) === String(id));
      if (!n) throw notFound();
      n.read_at ??= new Date().toISOString();
    },
  };
  return base;
}
