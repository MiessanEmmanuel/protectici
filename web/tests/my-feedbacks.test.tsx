import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyFeedback, Paginated } from '@/lib/api/types';
import { chooseOption } from './select-helpers';

const listMyFeedbacks = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: { listMyFeedbacks: (...args: unknown[]) => listMyFeedbacks(...args) },
}));

import { MyFeedbacksView } from '@/components/feedback/MyFeedbacksView';

afterEach(() => listMyFeedbacks.mockReset());

function feedback(over: Partial<MyFeedback> = {}): MyFeedback {
  return {
    id: 5,
    reference: 'DMT-2026-000005',
    status: 'in_progress',
    action_type: 'complaint',
    target_type: 'service',
    provider: { slug: 'citadelle', name: 'Citadelle Guard Services' },
    service_type: { id: 1, slug: 'gardiennage', name: 'Gardiennage' },
    topic: { id: 4, slug: 'ponctualite', name: 'Ponctualité' },
    comment: 'Les agents sont arrivés en retard.',
    has_voice: false,
    created_at: '2026-10-01T08:00:00Z',
    resolved_at: null,
    replies: [{ body: 'Nous avons contacté le prestataire.', created_at: '2026-10-02T08:00:00Z' }],
    ...over,
  };
}
const page = (data: MyFeedback[]): Paginated<MyFeedback> => ({
  data,
  meta: { current_page: 1, last_page: 1, per_page: 12, total: data.length },
  links: { next: null, prev: null },
});

describe('Mes dossiers « Dis-moi tout »', () => {
  it('affiche chaque dossier avec son statut et les réponses de l’équipe', async () => {
    listMyFeedbacks.mockResolvedValue(page([feedback()]));
    render(<MyFeedbacksView />);

    const card = await screen.findByRole('article', {
      name: 'Une plainte sur une prestation · Ponctualité',
    });
    expect(within(card).getByText('DMT-2026-000005')).toBeInTheDocument();
    expect(within(card).getByText('En cours de traitement')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Citadelle Guard Services' })).toHaveAttribute(
      'href',
      '/annuaire/citadelle',
    );
    expect(within(card).getByText('Nous avons contacté le prestataire.')).toBeInTheDocument();
  });

  it('renvoie vers le formulaire et la page de suivi quand la liste est vide', async () => {
    listMyFeedbacks.mockResolvedValue(page([]));
    render(<MyFeedbacksView />);

    expect(await screen.findByRole('link', { name: 'Envoyer un message' })).toHaveAttribute(
      'href',
      '/dis-moi-tout',
    );
    expect(screen.getByRole('link', { name: 'page de suivi' })).toHaveAttribute(
      'href',
      '/dis-moi-tout/suivi',
    );
  });

  it('filtre par statut', async () => {
    const u = userEvent.setup();
    listMyFeedbacks.mockResolvedValue(page([feedback()]));
    render(<MyFeedbacksView />);
    await screen.findByRole('article');

    await chooseOption(u, screen.getByLabelText('Filtrer par statut'), 'resolved');
    await waitFor(() =>
      expect(listMyFeedbacks).toHaveBeenLastCalledWith({ status: 'resolved', page: 1 }),
    );
  });
});
