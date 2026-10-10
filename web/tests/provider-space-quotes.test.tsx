import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { Paginated, ProviderQuote } from '@/lib/api/types';

const session = vi.hoisted(() => ({
  value: { status: 'authenticated' as 'authenticated' | 'anonymous', user: { email_verified: true } as unknown },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/espace-prestataire/devis',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ ...session.value, refresh: vi.fn(), setUser: vi.fn(), logout: vi.fn() }),
}));

let QuotesReceived: typeof import('@/components/provider-space/QuotesReceived').QuotesReceived;
let ProviderSpaceNav: typeof import('@/components/provider-space/ProviderSpaceNav').ProviderSpaceNav;
let RequireAuth: typeof import('@/components/establishment/RequireAuth').RequireAuth;
let clientApi: typeof import('@/lib/api/client').clientApi;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ({ clientApi } = await import('@/lib/api/client'));
  ({ QuotesReceived } = await import('@/components/provider-space/QuotesReceived'));
  ({ ProviderSpaceNav } = await import('@/components/provider-space/ProviderSpaceNav'));
  ({ RequireAuth } = await import('@/components/establishment/RequireAuth'));
  await clientApi.login({ email: 'proprietaire1@example.test', password: 'motdepasse' });
});

afterEach(() => vi.restoreAllMocks());

const meta = { current_page: 1, last_page: 1, per_page: 12, total: 1 };
function quote(over: Partial<ProviderQuote> = {}): ProviderQuote {
  return {
    id: 7,
    reference: 'DEV-2026-000007',
    requester: { name: 'Awa Koné', email: 'awa@example.test', phone: '+225 07 00 00 00 00', company_name: 'Société Test' },
    service: { id: 1, slug: 'gardiennage', name: 'Gardiennage' },
    city: { name: 'Abidjan' },
    district: { name: 'Cocody' },
    description: 'Besoin de deux gardiens de nuit.',
    desired_start_date: '2026-11-01',
    budget_range: '500 000 – 1 000 000 FCFA',
    status: 'sent',
    sent_at: '2026-10-01T08:00:00Z',
    viewed_at: null,
    replied_at: null,
    response_message: null,
    quoted_amount: null,
    ...over,
  };
}
function page(data: ProviderQuote[]): Paginated<ProviderQuote> {
  return { data, meta: { ...meta, total: data.length }, links: { next: null, prev: null } };
}

describe('devis reçus : accès et navigation', () => {
  it('invite un visiteur anonyme à se connecter', () => {
    session.value = { status: 'anonymous', user: null };
    render(
      <RequireAuth redirectTo="/espace-prestataire/devis" intro="Connectez-vous.">
        <QuotesReceived />
      </RequireAuth>,
    );
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    session.value = { status: 'authenticated', user: { email_verified: true } };
  });

  it('marque la page courante dans la navigation', () => {
    render(<ProviderSpaceNav />);
    expect(screen.getByRole('link', { name: 'Devis reçus' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Avis reçus' })).not.toHaveAttribute('aria-current');
  });

  it('renvoie vers l’inscription quand le compte n’est propriétaire d’aucune fiche (403)', async () => {
    vi.spyOn(clientApi, 'listMyQuotes').mockRejectedValue(new ApiError(403, 'Interdit'));
    render(<QuotesReceived />);
    expect(await screen.findByRole('link', { name: 'Inscrire mon établissement' })).toHaveAttribute(
      'href',
      '/inscription-etablissement',
    );
  });
});

describe('devis reçus : liste et détail', () => {
  it('liste les devis, compte les statuts et filtre', async () => {
    const u = userEvent.setup();
    const list = vi.spyOn(clientApi, 'listMyQuotes');
    render(<QuotesReceived />);
    const table = await screen.findByRole('table', { name: 'Devis reçus' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.getByRole('list', { name: 'Nombre de devis par statut' })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Filtrer par statut'), 'replied');
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: 'replied', page: 1 }));
  });

  it('ouvre un devis : détail complet et statut consulté', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    const get = vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(quote({ status: 'viewed' }));
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    expect(await screen.findByRole('heading', { name: 'Devis DEV-2026-000007' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(7);
    expect(screen.getByRole('link', { name: 'awa@example.test' })).toHaveAttribute('href', 'mailto:awa@example.test');
    expect(screen.getByRole('link', { name: '+225 07 00 00 00 00' })).toHaveAttribute('href', 'tel:+2250700000000');
    expect(screen.getByText('Besoin de deux gardiens de nuit.')).toBeInTheDocument();
    expect(screen.getByText('Société Test')).toBeInTheDocument();
    // la ligne de la liste est actualisée
    const row = screen.getByRole('row', { name: /DEV-2026-000007/ });
    expect(within(row).getByText('Consulté')).toBeInTheDocument();
  });

  it('répond avec un montant après confirmation, une seule fois', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    const get = vi
      .spyOn(clientApi, 'getMyQuote')
      .mockResolvedValueOnce(quote({ status: 'viewed' }))
      .mockResolvedValue(
        quote({ status: 'replied', response_message: 'Nous pouvons commencer en novembre.', quoted_amount: 750000 }),
      );
    const reply = vi.spyOn(clientApi, 'replyToQuote').mockResolvedValue(undefined);
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    await u.click(await screen.findByRole('button', { name: 'Répondre' }));
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await screen.findByText(/au moins 10 caractères/i)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Votre message/), 'Nous pouvons commencer en novembre.');
    await u.type(screen.getByLabelText(/Montant proposé/), 'abc');
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await screen.findByText(/nombre entier de FCFA/)).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/Montant proposé/));
    await u.type(screen.getByLabelText(/Montant proposé/), '750000');
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/ne pourra plus être modifiée/)).toBeInTheDocument();
    await u.dblClick(within(dialog).getByRole('button', { name: 'Envoyer la réponse' }));
    await waitFor(() => expect(reply).toHaveBeenCalledTimes(1));
    expect(reply).toHaveBeenCalledWith(7, { message: 'Nous pouvons commencer en novembre.', quoted_amount: 750000 });
    expect(await screen.findByText('Votre réponse a été envoyée au demandeur.')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Répondre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Décliner' })).not.toBeInTheDocument();
  });

  it('répond sans montant', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(quote({ status: 'viewed' }));
    const reply = vi.spyOn(clientApi, 'replyToQuote').mockResolvedValue(undefined);
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    await u.click(await screen.findByRole('button', { name: 'Répondre' }));
    await u.type(screen.getByLabelText(/Votre message/), 'Contactez-nous pour une visite.');
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Envoyer la réponse' }));
    await waitFor(() => expect(reply).toHaveBeenCalledWith(7, { message: 'Contactez-nous pour une visite.' }));
  });

  it('décline avec un motif facultatif après confirmation', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(quote({ status: 'viewed' }));
    const decline = vi.spyOn(clientApi, 'declineQuote').mockResolvedValue(undefined);
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    await u.click(await screen.findByRole('button', { name: 'Décliner' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText(/Motif/), 'Zone non couverte');
    await u.click(within(dialog).getByRole('button', { name: 'Décliner la demande' }));
    await waitFor(() => expect(decline).toHaveBeenCalledWith(7, 'Zone non couverte'));
    expect(await screen.findByText('La demande a été déclinée.')).toBeInTheDocument();
  });

  it('gère un 409 à la réponse', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(quote({ status: 'viewed' }));
    vi.spyOn(clientApi, 'replyToQuote').mockRejectedValue(new ApiError(409, 'Déjà répondu'));
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    await u.click(await screen.findByRole('button', { name: 'Répondre' }));
    await u.type(screen.getByLabelText(/Votre message/), 'Contactez-nous pour une visite.');
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await screen.findByText(/déjà reçu une réponse/)).toBeInTheDocument();
  });

  it('gère un 403 à la réponse avec un lien vers l’inscription', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([quote()]));
    vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(quote({ status: 'viewed' }));
    vi.spyOn(clientApi, 'declineQuote').mockRejectedValue(new ApiError(403, 'Interdit'));
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    await u.click(await screen.findByRole('button', { name: 'Décliner' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Décliner la demande' }));
    expect(await screen.findByText(/pas propriétaire d’une fiche/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inscrire mon établissement' })).toBeInTheDocument();
  });

  it('affiche les textes libres comme du texte et masque les actions d’un devis déjà décliné', async () => {
    const u = userEvent.setup();
    const q = quote({ status: 'declined', description: '<b>gras</b><script>alert(1)</script>' });
    vi.spyOn(clientApi, 'listMyQuotes').mockResolvedValue(page([q]));
    vi.spyOn(clientApi, 'getMyQuote').mockResolvedValue(q);
    render(<QuotesReceived />);
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le devis DEV-2026-000007' }));
    expect(await screen.findByText('<b>gras</b><script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Répondre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Décliner' })).not.toBeInTheDocument();
  });
});
