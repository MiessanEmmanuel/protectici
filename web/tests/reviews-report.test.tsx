import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { Review } from '@/lib/api/types';

type Sess = { user: { email_verified: boolean } | null; status: 'loading' | 'anonymous' | 'authenticated' };
let session: Sess = { user: { email_verified: true }, status: 'authenticated' };
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));

let impl: () => Promise<void> = async () => undefined;
const reportReview = vi.fn((...args: unknown[]) => {
  void args;
  return impl();
});
vi.mock('@/lib/api/client', () => ({
  clientApi: { reportReview: (...a: unknown[]) => reportReview(...a) },
}));

import { ReviewsList } from '@/components/directory/ReviewsList';

const reviews: Review[] = [
  {
    id: 7,
    rating: 4,
    title: '<img src=x onerror=alert(1)>',
    body: '<script>alert("xss")</script>\nDeuxième ligne',
    author: 'Awa K.',
    created_at: '2026-09-01T10:00:00Z',
    provider_reply: '<b>Merci</b>',
    provider_replied_at: '2026-09-02T10:00:00Z',
  },
];

function setup() {
  render(<ReviewsList reviews={reviews} redirectTo="/annuaire/agence-x" />);
  return userEvent.setup();
}

describe('Signalement d’un avis', () => {
  beforeEach(() => {
    reportReview.mockClear();
    impl = async () => undefined;
    session = { user: { email_verified: true }, status: 'authenticated' };
  });

  it('affiche le texte de l’avis et la réponse littéralement (pas de HTML)', () => {
    setup();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\("xss"\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText('<b>Merci</b>')).toBeInTheDocument();
    expect(document.querySelector('script, img[onerror], b')).toBeNull();
  });

  it('anonyme : invitation à se connecter', async () => {
    session = { user: null, status: 'anonymous' };
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?redirect=%2Fannuaire%2Fagence-x',
    );
    expect(reportReview).not.toHaveBeenCalled();
  });

  it('la raison est obligatoire', async () => {
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText('Choisissez une raison.')).toBeInTheDocument();
    expect(reportReview).not.toHaveBeenCalled();
  });

  it('succès : appel avec raison et précisions, confirmation', async () => {
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.selectOptions(screen.getByLabelText(/Raison du signalement/), 'spam');
    await u.type(screen.getByLabelText(/Précisions/), 'Publicité déguisée');
    await u.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText('Signalement envoyé. Merci.')).toBeInTheDocument();
    expect(reportReview).toHaveBeenCalledWith(7, { reason: 'spam', details: 'Publicité déguisée' });
    expect(screen.queryByRole('button', { name: /Signaler/ })).toBeNull();
  });

  it('rejeu (204 déjà enregistré) = succès', async () => {
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.selectOptions(screen.getByLabelText(/Raison du signalement/), 'other');
    await u.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText('Signalement envoyé. Merci.')).toBeInTheDocument();
    expect(reportReview).toHaveBeenCalledWith(7, { reason: 'other' });
  });

  it.each([
    [401, 'Vous devez être connecté pour effectuer cette action.'],
    [403, 'Vous n’avez pas le droit de signaler cet avis.'],
    [404, 'Cet avis n’est plus disponible.'],
  ])('erreur %i affichée dans la fenêtre', async (status, message) => {
    impl = async () => {
      throw new ApiError(status, status === 403 ? message : 'x');
    };
    if (status === 401) impl = async () => { throw new ApiError(401, message); };
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.selectOptions(screen.getByLabelText(/Raison du signalement/), 'offensive');
    await u.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(message);
  });

  it('429 : délai indiqué', async () => {
    impl = async () => {
      throw new ApiError(429, 'Trop', {}, 30);
    };
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.selectOptions(screen.getByLabelText(/Raison du signalement/), 'spam');
    await u.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('30 secondes');
  });

  it('double clic : un seul appel', async () => {
    let release: () => void = () => undefined;
    impl = () => new Promise<void>((r) => (release = () => r()));
    const u = setup();
    await u.click(screen.getByRole('button', { name: /Signaler/ }));
    await u.selectOptions(screen.getByLabelText(/Raison du signalement/), 'spam');
    await u.dblClick(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(reportReview).toHaveBeenCalledTimes(1);
    release();
    await screen.findByText('Signalement envoyé. Merci.');
  });
});
