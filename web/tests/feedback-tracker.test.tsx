import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const trackFeedback = vi.fn();
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: { trackFeedback: (...args: unknown[]) => trackFeedback(...args) },
}));

import { FeedbackTracker, TRACK_NOT_FOUND } from '@/components/feedback/FeedbackTracker';

async function submit(reference = 'dmt-2026-000101', email = 'awa.demo@example.test') {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText(/^Référence/), reference);
  await u.type(screen.getByLabelText(/^Adresse e-mail/), email);
  await u.click(screen.getByRole('button', { name: 'Consulter mon dossier' }));
  return u;
}

describe('FeedbackTracker', () => {
  beforeEach(() => {
    trackFeedback.mockReset();
    push.mockClear();
    replace.mockClear();
  });

  it('valide les champs avant l’appel', async () => {
    const u = userEvent.setup();
    render(<FeedbackTracker />);
    await u.click(screen.getByRole('button', { name: 'Consulter mon dossier' }));
    expect(screen.getByText('La référence est requise.')).toBeInTheDocument();
    expect(trackFeedback).not.toHaveBeenCalled();
  });

  it('affiche le statut, la date, le prestataire et les réponses en texte brut', async () => {
    trackFeedback.mockResolvedValue({
      reference: 'DMT-2026-000101',
      status: 'in_progress',
      created_at: '2026-10-01T10:00:00Z',
      provider_name: 'Dauphin Sécurité',
      replies: [{ body: 'Bonjour <script>alert(1)</script> <b>merci</b>\nLigne 2', created_at: '2026-10-02T09:00:00Z' }],
    });
    const { container } = render(<FeedbackTracker />);
    await submit();
    expect(await screen.findByRole('heading', { name: 'Dossier DMT-2026-000101' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dossier DMT-2026-000101' })).toHaveFocus());
    expect(screen.getByText('En cours de traitement')).toBeInTheDocument();
    expect(screen.getByText('Dauphin Sécurité')).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script> <b>merci<\/b>/)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(trackFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'DMT-2026-000101', email: 'awa.demo@example.test', company_website: '' }),
    );
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('affiche le même message générique pour une référence inconnue et un e-mail faux', async () => {
    trackFeedback.mockRejectedValue(new ApiError(404, 'Aucun dossier ne correspond à ces informations.'));
    const first = render(<FeedbackTracker />);
    await submit('DMT-2026-999999', 'awa.demo@example.test');
    const m1 = (await screen.findByRole('alert', { name: '' }, { timeout: 2000 }).catch(() => null)) ?? null;
    expect(await screen.findByText(TRACK_NOT_FOUND)).toBeInTheDocument();
    void m1;
    first.unmount();
    render(<FeedbackTracker />);
    await submit('DMT-2026-000101', 'autre@example.test');
    expect(await screen.findByText(TRACK_NOT_FOUND)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/référence inconnue|e-mail incorrect/i);
  });

  it('gère le 429 avec le délai', async () => {
    trackFeedback.mockRejectedValue(new ApiError(429, 'Trop', {}, 60));
    render(<FeedbackTracker />);
    await submit();
    expect(await screen.findByText(/Réessayez dans 60 secondes/)).toBeInTheDocument();
  });

  it('Turnstile désactivé : aucun widget', () => {
    render(<FeedbackTracker />);
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument();
  });
});
