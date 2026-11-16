import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Paginated, SentQuote } from '@/lib/api/types';
import { chooseOption } from './select-helpers';

const listSentQuotes = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: { listSentQuotes: (...args: unknown[]) => listSentQuotes(...args) },
}));

import { SentQuotesView } from '@/components/quote/SentQuotesView';

afterEach(() => listSentQuotes.mockReset());

function quote(over: Partial<SentQuote> = {}): SentQuote {
  return {
    id: 3,
    reference: 'DEV-2026-000003',
    service: { id: 1, slug: 'gardiennage', name: 'Gardiennage' },
    city: { name: 'Abidjan' },
    district: { name: 'Cocody' },
    description: 'Besoin de deux gardiens de nuit.',
    desired_start_date: null,
    budget_range: null,
    status: 'answered',
    created_at: '2026-10-01T08:00:00Z',
    recipients: [
      {
        provider: { slug: 'citadelle', name: 'Citadelle Guard Services' },
        status: 'replied',
        sent_at: '2026-10-01T08:00:00Z',
        replied_at: '2026-10-03T08:00:00Z',
        response_message: 'Voici notre proposition.',
        quoted_amount: 750000,
      },
      {
        provider: { slug: 'griffon', name: 'Griffon Sûreté' },
        status: 'sent',
        sent_at: '2026-10-01T08:00:00Z',
        replied_at: null,
        response_message: null,
        quoted_amount: null,
      },
    ],
    ...over,
  };
}
const page = (data: SentQuote[]): Paginated<SentQuote> => ({
  data,
  meta: { current_page: 1, last_page: 1, per_page: 12, total: data.length },
  links: { next: null, prev: null },
});

describe('Mes demandes de devis', () => {
  it('affiche chaque demande avec la réponse des prestataires', async () => {
    listSentQuotes.mockResolvedValue(page([quote()]));
    render(<SentQuotesView />);

    const card = await screen.findByRole('article', { name: /Gardiennage · Abidjan, Cocody/ });
    expect(within(card).getByText('DEV-2026-000003')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Citadelle Guard Services' })).toHaveAttribute(
      'href',
      '/annuaire/citadelle',
    );
    expect(within(card).getByText('Voici notre proposition.')).toBeInTheDocument();
    expect(within(card).getByText(/750/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Griffon Sûreté' })).toBeInTheDocument();
  });

  it('propose de demander un devis quand la liste est vide', async () => {
    listSentQuotes.mockResolvedValue(page([]));
    render(<SentQuotesView />);

    expect(
      await screen.findByText('Vous n’avez pas encore de demande de devis'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander un devis' })).toHaveAttribute(
      'href',
      '/devis',
    );
  });

  it('filtre par statut', async () => {
    const u = userEvent.setup();
    listSentQuotes.mockResolvedValue(page([quote()]));
    render(<SentQuotesView />);
    await screen.findByRole('article');

    await chooseOption(u, screen.getByLabelText('Filtrer par statut'), 'closed');
    await waitFor(() =>
      expect(listSentQuotes).toHaveBeenLastCalledWith({ status: 'closed', page: 1 }),
    );
  });
});
