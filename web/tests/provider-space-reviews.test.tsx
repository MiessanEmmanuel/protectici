import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { OwnerReview, Paginated } from '@/lib/api/types';

const nav = vi.hoisted(() => ({ fiche: '' as string, replace: vi.fn() }));
const session = vi.hoisted(() => ({
  value: { status: 'authenticated' as 'authenticated' | 'anonymous', user: { email_verified: true } as unknown },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/espace-prestataire/avis',
  useSearchParams: () => new URLSearchParams(nav.fiche ? `fiche=${nav.fiche}` : ''),
}));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ ...session.value, refresh: vi.fn(), setUser: vi.fn(), logout: vi.fn() }),
}));

let ReviewsReceived: typeof import('@/components/provider-space/ReviewsReceived').ReviewsReceived;
let RequireAuth: typeof import('@/components/establishment/RequireAuth').RequireAuth;
let clientApi: typeof import('@/lib/api/client').clientApi;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ({ clientApi } = await import('@/lib/api/client'));
  ({ ReviewsReceived } = await import('@/components/provider-space/ReviewsReceived'));
  ({ RequireAuth } = await import('@/components/establishment/RequireAuth'));
  await clientApi.login({ email: 'proprietaire1@example.test', password: 'motdepasse' });
});

afterEach(() => {
  vi.restoreAllMocks();
  nav.fiche = '';
  nav.replace.mockClear();
});

const meta = { current_page: 1, last_page: 1, per_page: 12, total: 0 };
function page(data: OwnerReview[]): Paginated<OwnerReview> {
  return { data, meta: { ...meta, total: data.length }, links: { next: null, prev: null } };
}
function review(over: Partial<OwnerReview> = {}): OwnerReview {
  return {
    id: 1,
    rating: 4,
    title: 'Très bien',
    body: 'Service rapide et courtois.',
    author: 'Awa K.',
    status: 'approved',
    created_at: '2026-09-01T10:00:00Z',
    provider_reply: null,
    provider_replied_at: null,
    ...over,
  };
}
async function firstSlug() {
  const res = await clientApi.listMyEstablishments(1);
  return res.data.find((e) => e.type === 'provider' && e.status === 'approved')!.slug;
}

describe('avis reçus : accès', () => {
  it('invite un visiteur anonyme à se connecter', () => {
    session.value = { status: 'anonymous', user: null };
    render(
      <RequireAuth redirectTo="/espace-prestataire/avis" intro="Connectez-vous.">
        <ReviewsReceived />
      </RequireAuth>,
    );
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Fiche concernée')).not.toBeInTheDocument();
    session.value = { status: 'authenticated', user: { email_verified: true } };
  });

  it('explique l’absence de fiche validée', async () => {
    vi.spyOn(clientApi, 'listMyEstablishments').mockResolvedValue({
      data: [
        {
          type: 'provider', slug: 'x', name: 'X', status: 'pending', rejection_reason: null, is_visible: false,
          is_verified: false, submitted_at: '2026-09-01T10:00:00Z', reviewed_at: null, pending_change_requests: 0,
        },
      ],
      meta,
      links: { next: null, prev: null },
    });
    render(<ReviewsReceived />);
    expect(await screen.findByText('Aucune fiche prestataire validée')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir mes établissements' })).toHaveAttribute('href', '/espace-prestataire');
  });
});

describe('avis reçus : sélection et filtre', () => {
  it('mémorise la fiche dans ?fiche= et filtre par statut', async () => {
    const u = userEvent.setup();
    const slug = await firstSlug();
    const list = vi.spyOn(clientApi, 'listOwnerReviews');
    render(<ReviewsReceived />);
    const select = await screen.findByLabelText('Fiche concernée');
    expect(select).toHaveValue(slug); // une seule fiche : sélectionnée d’office
    await u.selectOptions(select, slug);
    expect(nav.replace).toHaveBeenCalledWith(`/espace-prestataire/avis?fiche=${slug}`);
    await screen.findByRole('list', { name: 'Avis reçus' });
    await u.selectOptions(screen.getByLabelText('Filtrer par statut'), 'rejected');
    await waitFor(() => expect(list).toHaveBeenCalledWith(slug, { status: 'rejected', page: 1 }));
  });
});

describe('avis reçus : réponse unique', () => {
  async function setup(reviews: OwnerReview[]) {
    nav.fiche = await firstSlug();
    vi.spyOn(clientApi, 'listOwnerReviews').mockResolvedValue(page(reviews));
    render(<ReviewsReceived />);
    await screen.findByRole('list', { name: 'Avis reçus' });
  }

  it('valide, demande confirmation puis envoie une seule fois', async () => {
    const u = userEvent.setup();
    const reply = vi.spyOn(clientApi, 'replyToReview').mockResolvedValue(undefined);
    await setup([review()]);
    await u.click(screen.getByRole('button', { name: 'Répondre à cet avis' }));
    expect(await screen.findByText(/au moins 5 caractères/i)).toBeInTheDocument();
    expect(reply).not.toHaveBeenCalled();
    await u.type(screen.getByLabelText('Votre réponse'), 'Merci pour votre confiance.');
    await u.click(screen.getByRole('button', { name: 'Répondre à cet avis' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/ne pourra plus être modifiée/)).toBeInTheDocument();
    expect(reply).not.toHaveBeenCalled();
    await u.dblClick(within(dialog).getByRole('button', { name: 'Publier la réponse' }));
    await waitFor(() => expect(reply).toHaveBeenCalledTimes(1));
    expect(reply).toHaveBeenCalledWith(nav.fiche, 1, 'Merci pour votre confiance.');
    expect(await screen.findByText('Votre réponse a été publiée.')).toBeInTheDocument();
  });

  it('gère un 409 : message et rechargement', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'replyToReview').mockRejectedValue(new ApiError(409, 'Déjà répondu.'));
    await setup([review()]);
    const list = vi.mocked(clientApi.listOwnerReviews);
    const calls = list.mock.calls.length;
    await u.type(screen.getByLabelText('Votre réponse'), 'Merci beaucoup.');
    await u.click(screen.getByRole('button', { name: 'Répondre à cet avis' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publier la réponse' }));
    expect(await screen.findByText(/déjà répondu à cet avis/)).toBeInTheDocument();
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(calls));
  });

  it('gère un 404', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'replyToReview').mockRejectedValue(new ApiError(404, 'Introuvable'));
    await setup([review()]);
    await u.type(screen.getByLabelText('Votre réponse'), 'Merci beaucoup.');
    await u.click(screen.getByRole('button', { name: 'Répondre à cet avis' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publier la réponse' }));
    expect(await screen.findByText(/n’est plus disponible/)).toBeInTheDocument();
  });

  it('n’offre aucune réponse pour un avis déjà répondu, en attente ou rejeté', async () => {
    await setup([
      review({ id: 1, provider_reply: 'Merci !', provider_replied_at: '2026-09-02T10:00:00Z' }),
      review({ id: 2, status: 'pending' }),
      review({ id: 3, status: 'rejected' }),
    ]);
    expect(screen.queryByRole('button', { name: 'Répondre à cet avis' })).not.toBeInTheDocument();
    expect(screen.getByText('Merci !')).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
  });

  it('affiche les textes libres comme du texte, jamais comme du HTML', async () => {
    await setup([review({ body: '<b>gras</b><script>alert(1)</script>', title: '<i>titre</i>' })]);
    expect(screen.getByText('<b>gras</b><script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.getByText('<i>titre</i>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
