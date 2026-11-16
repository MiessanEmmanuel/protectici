import { ApiError } from '../api/errors';
import type {
  AdminClaim,
  ClaimInput,
  ClaimsApi,
  ClaimStatus,
  MyClaim,
  SimilarEstablishment,
} from '../api/claims';
import type { EstablishmentType, Paginated } from '../api/types';
import { stateForces } from './forces';
import { providers } from './providers';

/**
 * Revendications FICTIVES pour le mode démo et les tests (contrat §10.3).
 * Fiches « sans propriétaire » simulées : celles listées ci-dessous.
 */
export const CLAIMABLE_MOCK_SLUGS = new Set<string>([
  'vigie-telesurveillance',
  'cerbere-brigade-canine',
  'brigade-de-gendarmerie-de-bingerville',
]);

/** Fiche revendicable en démo (utilisé par getProvider / getStateForce factices). */
export function isMockClaimable(slug: string): boolean {
  return CLAIMABLE_MOCK_SLUGS.has(slug);
}

const delay = (ms = 80) =>
  typeof window === 'undefined' ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));

const normalize = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Entry {
  type: EstablishmentType;
  id: number;
  slug: string;
  name: string;
  city: { name: string };
  phone: string | null;
}

function directory(): Entry[] {
  return [
    ...providers.map((p, i) => ({
      type: 'provider' as const,
      id: i + 1,
      slug: p.slug,
      name: p.name,
      city: { name: p.city.name },
      phone: p.phone,
    })),
    ...stateForces.map((f, i) => ({
      type: 'state_force' as const,
      id: i + 1,
      slug: f.slug,
      name: f.name,
      city: { name: f.city.name },
      phone: f.phone,
    })),
  ];
}

function find(type: EstablishmentType, slug: string): Entry {
  const e = directory().find((x) => x.type === type && x.slug === slug);
  if (!e) throw new ApiError(404, 'Cette page ou cette ressource est introuvable.');
  return e;
}

const DEMO_USER = { id: 1, name: 'Compte de démonstration', email: 'demo@example.test' };

let nextId = 3;
const claims: AdminClaim[] = [
  {
    id: 1,
    status: 'pending',
    establishment: (() => {
      const e = find('provider', 'vigie-telesurveillance');
      return { type: e.type, id: e.id, slug: e.slug, name: e.name, city: e.city };
    })(),
    user: { id: 21, name: 'Koffi Yao', email: 'koffi.yao@example.test' },
    submitter_role: 'manager',
    phone: '+2250700000021',
    message: 'Je suis le gérant de l’entreprise et souhaite mettre à jour nos coordonnées.',
    document: { name: 'extrait-rccm.pdf', mime_type: 'application/pdf', size_bytes: 248_000 },
    rejection_reason: null,
    reviewer: null,
    created_at: '2026-10-22T09:15:00Z',
    reviewed_at: null,
  },
  {
    id: 2,
    status: 'rejected',
    establishment: (() => {
      const e = find('state_force', 'brigade-de-gendarmerie-de-bingerville');
      return { type: e.type, id: e.id, slug: e.slug, name: e.name, city: e.city };
    })(),
    user: { id: 22, name: 'Aminata Traoré', email: 'aminata.traore@example.test' },
    submitter_role: 'employee',
    phone: '+2250500000022',
    message: null,
    document: { name: 'carte-professionnelle.jpg', mime_type: 'image/jpeg', size_bytes: 512_000 },
    rejection_reason: 'Le justificatif fourni est illisible. Merci d’envoyer un courrier officiel.',
    reviewer: { id: 2, name: 'Équipe ProtectIci' },
    created_at: '2026-10-18T14:00:00Z',
    reviewed_at: '2026-10-19T10:30:00Z',
  },
];
const owned = new Set<string>();

const key = (type: EstablishmentType, slug: string) => `${type}:${slug}`;

function toMine(c: AdminClaim): MyClaim {
  return {
    id: c.id,
    status: c.status,
    establishment: {
      type: c.establishment.type,
      slug: c.establishment.slug,
      name: c.establishment.name,
    },
    rejection_reason: c.rejection_reason,
    created_at: c.created_at,
    reviewed_at: c.reviewed_at,
  };
}

function paginate<T>(items: T[], page = 1, per = 10): Paginated<T> {
  const last = Math.max(1, Math.ceil(items.length / per));
  const current = Math.min(Math.max(page, 1), last);
  return {
    data: items.slice((current - 1) * per, current * per),
    meta: { current_page: current, last_page: last, per_page: per, total: items.length },
    links: {
      next: current < last ? `?page=${current + 1}` : null,
      prev: current > 1 ? `?page=${current - 1}` : null,
    },
  };
}

function getClaim(id: number): AdminClaim {
  const c = claims.find((x) => x.id === id);
  if (!c) throw new ApiError(404, 'Cette demande est introuvable.');
  return c;
}

function validate(input: ClaimInput): void {
  const errors: Record<string, string[]> = {};
  if (!input.submitter_role) errors.submitter_role = ['Indiquez votre qualité.'];
  if (!input.phone.trim()) errors.phone = ['Le numéro de téléphone est obligatoire.'];
  if (!input.consent) errors.consent = ['Vous devez accepter les conditions pour continuer.'];
  if (Object.keys(errors).length) {
    throw new ApiError(422, 'Certaines informations sont invalides.', errors);
  }
}

export const mockClaimsApi: ClaimsApi = {
  async submitClaim(type, slug, input) {
    await delay();
    const e = find(type, slug);
    if (owned.has(key(type, slug)) || !isMockClaimable(slug)) {
      throw new ApiError(409, 'Cette fiche est déjà gérée par un compte.');
    }
    if (
      claims.some(
        (c) =>
          c.status === 'pending' &&
          c.user?.id === DEMO_USER.id &&
          c.establishment.type === type &&
          c.establishment.slug === slug,
      )
    ) {
      throw new ApiError(409, 'Vous avez déjà une demande en cours pour cette fiche.');
    }
    validate(input);
    const claim: AdminClaim = {
      id: nextId++,
      status: 'pending',
      establishment: { type: e.type, id: e.id, slug: e.slug, name: e.name, city: e.city },
      user: DEMO_USER,
      submitter_role: input.submitter_role,
      phone: input.phone.trim(),
      message: input.message?.trim() || null,
      document: {
        name: input.document.name,
        mime_type: input.document.type,
        size_bytes: input.document.size,
      },
      rejection_reason: null,
      reviewer: null,
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };
    claims.unshift(claim);
    return toMine(claim);
  },
  async listMyClaims() {
    await delay();
    return claims.filter((c) => c.user?.id === DEMO_USER.id).map(toMine);
  },
  async findSimilarEstablishments(query) {
    await delay();
    const name = normalize(query.name);
    if (name.length < 3) return [];
    const phone = query.phone?.replace(/\D/g, '') ?? '';
    return directory()
      .filter((e) => e.type === query.type)
      .filter(
        (e) =>
          normalize(e.name).includes(name) ||
          name.includes(normalize(e.name)) ||
          (phone.length >= 8 && (e.phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-8))),
      )
      .slice(0, 5)
      .map((e): SimilarEstablishment => ({
        type: e.type,
        slug: e.slug,
        name: e.name,
        city: e.city,
        is_claimable: isMockClaimable(e.slug) && !owned.has(key(e.type, e.slug)),
      }));
  },
  async adminListClaims(query = {}) {
    await delay();
    const status: ClaimStatus = query.status ?? 'pending';
    return paginate(
      claims.filter((c) => c.status === status),
      query.page,
    );
  },
  async adminGetClaim(id) {
    await delay();
    return getClaim(id);
  },
  async adminDownloadClaimDocument(id) {
    const c = getClaim(id);
    return new Blob(['Justificatif de démonstration'], {
      type: c.document?.mime_type ?? 'application/pdf',
    });
  },
  async adminApproveClaim(id) {
    await delay();
    const c = getClaim(id);
    if (c.status === 'approved') return c;
    const k = key(c.establishment.type, c.establishment.slug);
    if (owned.has(k)) throw new ApiError(409, 'Cette fiche est déjà gérée par un compte.');
    owned.add(k);
    c.status = 'approved';
    c.reviewer = { id: 2, name: 'Équipe ProtectIci' };
    c.reviewed_at = new Date().toISOString();
    for (const other of claims) {
      if (
        other !== c &&
        other.status === 'pending' &&
        key(other.establishment.type, other.establishment.slug) === k
      ) {
        other.status = 'rejected';
        other.rejection_reason = 'Fiche attribuée à un autre compte.';
        other.reviewed_at = c.reviewed_at;
      }
    }
    return c;
  },
  async adminRejectClaim(id, reason) {
    await delay();
    const c = getClaim(id);
    if (c.status !== 'pending') return;
    if (reason.trim().length < 10) {
      throw new ApiError(422, 'Certaines informations sont invalides.', {
        reason: ['Le motif doit contenir au moins 10 caractères.'],
      });
    }
    c.status = 'rejected';
    c.rejection_reason = reason.trim();
    c.reviewer = { id: 2, name: 'Équipe ProtectIci' };
    c.reviewed_at = new Date().toISOString();
  },
  async adminAssignOwner(type, id, email) {
    await delay();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ApiError(422, 'Certaines informations sont invalides.', {
        email: ['Aucun compte actif avec cet e-mail.'],
      });
    }
    const { mockApi } = await import('./mock-api');
    const est = await mockApi.adminGetEstablishment(type, id);
    owned.add(key(type, est.slug));
    return {
      ...est,
      owner: {
        id: 99,
        first_name: 'Compte',
        last_name: 'attribué',
        email: email.trim(),
        phone: null,
      },
    };
  },
};
