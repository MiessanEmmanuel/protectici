import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { MyReview, Paginated } from '@/lib/api/types';

const listMyReviews = vi.fn();
const updateMyReview = vi.fn();
const deleteMyReview = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    listMyReviews: (...a: unknown[]) => listMyReviews(...a),
    updateMyReview: (...a: unknown[]) => updateMyReview(...a),
    deleteMyReview: (...a: unknown[]) => deleteMyReview(...a),
  },
}));

import { MyReviewsView } from '@/components/reviews/MyReviewsView';

const base: MyReview = {
  id: 1,
  provider: { slug: 'agence-x', name: 'Agence X' },
  rating: 5,
  title: 'Parfait',
  body: 'Une intervention rapide et soignée.',
  status: 'approved',
  rejection_reason: null,
  is_visible: true,
  created_at: '2026-09-01T10:00:00Z',
  provider_reply: 'Merci pour votre confiance.',
};
const pending: MyReview = { ...base, id: 2, provider: { slug: 'garde-y', name: 'Garde Y' }, status: 'pending', provider_reply: null, title: null };
const rejected: MyReview = {
  ...base,
  id: 3,
  provider: { slug: 'secu-z', name: 'Secu Z' },
  status: 'rejected',
  rejection_reason: 'Propos non conformes à la charte.',
  provider_reply: null,
  body: '<script>alert(1)</script> avis rejeté',
};

function page(data: MyReview[], current = 1, last = 1): Paginated<MyReview> {
  return {
    data,
    meta: { current_page: current, last_page: last, per_page: 10, total: data.length },
  } as Paginated<MyReview>;
}

describe('MyReviewsView', () => {
  beforeEach(() => {
    listMyReviews.mockReset();
    updateMyReview.mockReset();
    deleteMyReview.mockReset();
  });

  it('état vide avec lien vers l’annuaire', async () => {
    listMyReviews.mockResolvedValue(page([]));
    render(<MyReviewsView />);
    expect(await screen.findByText('Vous n’avez pas encore donné d’avis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parcourir l’annuaire' })).toHaveAttribute('href', '/annuaire');
  });

  it('liste : statuts, motif de rejet, réponse, texte non interprété', async () => {
    listMyReviews.mockResolvedValue(page([base, pending, rejected]));
    render(<MyReviewsView />);
    expect(await screen.findByRole('link', { name: 'Agence X' })).toHaveAttribute('href', '/annuaire/agence-x');
    expect(screen.getByText('Publié')).toBeInTheDocument();
    expect(screen.getByText('En attente de modération')).toBeInTheDocument();
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
    expect(screen.getByText('Propos non conformes à la charte.')).toBeInTheDocument();
    expect(screen.getByText('Merci pour votre confiance.')).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script> avis rejeté/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('modification : avertissement, appel, retour en attente', async () => {
    listMyReviews.mockResolvedValue(page([base]));
    updateMyReview.mockResolvedValue({ ...base, body: 'Texte modifié suffisamment long.', status: 'pending' });
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click(await screen.findByRole('button', { name: /Modifier/ }));
    expect(
      screen.getByText(/La modification remet l’avis en modération et le masque jusqu’à validation/),
    ).toBeInTheDocument();
    const area = screen.getByLabelText(/Votre avis/, { selector: 'textarea' });
    await u.clear(area);
    await u.type(area, 'Texte modifié suffisamment long.');
    await u.click(screen.getByRole('button', { name: 'Enregistrer la modification' }));
    await waitFor(() => expect(updateMyReview).toHaveBeenCalledWith(1, {
      rating: 5,
      title: 'Parfait',
      body: 'Texte modifié suffisamment long.',
    }));
    expect(await screen.findByText('En attente de modération')).toBeInTheDocument();
    expect(screen.getByText(/de nouveau en attente de modération/)).toBeInTheDocument();
    expect(screen.getByText('Texte modifié suffisamment long.')).toBeInTheDocument();
  });

  it('modification invalide : aucun appel', async () => {
    listMyReviews.mockResolvedValue(page([base]));
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click(await screen.findByRole('button', { name: /Modifier/ }));
    const area = screen.getByLabelText(/Votre avis/, { selector: 'textarea' });
    await u.clear(area);
    await u.type(area, 'court');
    await u.click(screen.getByRole('button', { name: 'Enregistrer la modification' }));
    expect(await screen.findByText(/au moins 10 caractères/, { selector: 'p[id$="-error"]' })).toBeInTheDocument();
    expect(updateMyReview).not.toHaveBeenCalled();
  });

  it('modification : 409 affiche le message du serveur', async () => {
    listMyReviews.mockResolvedValue(page([base]));
    updateMyReview.mockRejectedValue(new ApiError(409, 'Cet avis ne peut plus être modifié.'));
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click(await screen.findByRole('button', { name: /Modifier/ }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer la modification' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cet avis ne peut plus être modifié.');
  });

  it('suppression : confirmation puis appel et rechargement', async () => {
    listMyReviews.mockResolvedValueOnce(page([base, pending])).mockResolvedValue(page([pending]));
    deleteMyReview.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click((await screen.findAllByRole('button', { name: /Supprimer/ }))[0]!);
    expect(deleteMyReview).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Supprimer l’avis' }));
    await waitFor(() => expect(deleteMyReview).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Avis supprimé.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Agence X' })).toBeNull());
  });

  it('suppression : 429 laissé dans la boîte, 404 recharge', async () => {
    listMyReviews.mockResolvedValue(page([base]));
    deleteMyReview.mockRejectedValueOnce(new ApiError(429, 'Trop', {}, 45));
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click(await screen.findByRole('button', { name: /Supprimer/ }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer l’avis' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('45 secondes');
    deleteMyReview.mockRejectedValueOnce(new ApiError(404, 'Introuvable'));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer l’avis' }));
    expect(await screen.findByText(/Cet avis n’existe plus/)).toBeInTheDocument();
  });

  it('pagination : demande la page suivante', async () => {
    listMyReviews.mockResolvedValueOnce(page([base], 1, 2)).mockResolvedValue(page([pending], 2, 2));
    const u = userEvent.setup();
    render(<MyReviewsView />);
    await u.click(await screen.findByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(listMyReviews).toHaveBeenLastCalledWith(2));
    expect(await screen.findByRole('link', { name: 'Garde Y' })).toBeInTheDocument();
  });
});
