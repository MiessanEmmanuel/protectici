import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminFeedback } from '@/lib/api/types';

const adminGetFeedback = vi.fn<(id: number) => Promise<AdminFeedback>>();
const adminReplyFeedback =
  vi.fn<(id: number, input: { body: string; is_internal: boolean }, key: string) => Promise<unknown>>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    adminGetFeedback: (id: number) => adminGetFeedback(id),
    adminReplyFeedback: (...args: Parameters<typeof adminReplyFeedback>) => adminReplyFeedback(...args),
    adminUpdateFeedback: vi.fn(),
    adminListUsers: vi.fn(async () => ({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    })),
  },
}));

import { FeedbackDetail } from '@/components/admin/feedback/FeedbackDetail';

const FEEDBACK: AdminFeedback = {
  id: 5,
  reference: 'DMT-2026-000105',
  author: { first_name: 'Awa', last_name: 'Koné', email: 'awa@example.test' },
  provider: null,
  action_type: 'complaint',
  target_type: 'service',
  status: 'new',
  assigned_to: null,
  created_at: '2026-10-20T10:00:00Z',
  voice: null,
  civility: null,
  phone: null,
  service_type: null,
  topic: null,
  product_type: null,
  location: null,
  comment: 'Un commentaire écrit.',
  consent_at: '2026-10-20T10:00:00Z',
  resolved_at: null,
  replies: [],
};

describe('Admin « Dis-moi tout » : réponse par e-mail (R01)', () => {
  beforeEach(() => {
    adminGetFeedback.mockReset();
    adminReplyFeedback.mockReset();
    adminGetFeedback.mockResolvedValue(FEEDBACK);
    adminReplyFeedback.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('la confirmation n’est pas imbriquée dans le formulaire et déclenche l’envoi', async () => {
    const u = userEvent.setup();
    render(<FeedbackDetail id={5} onChanged={() => {}} onClose={() => {}} />);
    await u.type(await screen.findByLabelText(/^Votre réponse/), 'Merci pour votre retour.');
    await u.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Envoyer l’e-mail' });
    // Aucun formulaire ancêtre au-dessus de celui de la boîte de confirmation.
    expect(confirm.closest('form')?.parentElement?.closest('form')).toBeNull();
    expect(adminReplyFeedback).not.toHaveBeenCalled();
    await u.click(confirm);
    await waitFor(() => expect(adminReplyFeedback).toHaveBeenCalledTimes(1));
    expect(adminReplyFeedback.mock.calls[0]![0]).toBe(5);
    expect(adminReplyFeedback.mock.calls[0]![1]).toEqual({
      body: 'Merci pour votre retour.',
      is_internal: false,
    });
    expect(await screen.findByText('Réponse envoyée à l’auteur par e-mail.')).toBeInTheDocument();
  });

  it('le sélecteur de statut du détail a un nom distinct du filtre de liste (R19)', async () => {
    render(<FeedbackDetail id={5} onChanged={() => {}} onClose={() => {}} />);
    expect(await screen.findByLabelText('Changer le statut du dossier')).toBeInTheDocument();
  });
});
