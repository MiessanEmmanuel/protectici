import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AdminChangeRequestRow } from '@/lib/api/types';
import { page, REFERENCE } from './admin-establishments-fixtures';

const api = vi.hoisted(() => ({
  adminListChangeRequests: vi.fn(),
  adminApproveChangeRequest: vi.fn(),
  adminRejectChangeRequest: vi.fn(),
  getReferenceData: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));

import { AdminChangeRequestsView } from '@/components/admin/modifications/AdminChangeRequestsView';
import { formatChangeValue } from '@/components/admin/modifications/change-format';

const request: AdminChangeRequestRow = {
  id: 3,
  type: 'provider',
  establishment: { id: 7, name: 'Sentinelle Sécurité' },
  changes: {
    name: { old: 'Sentinelle', new: 'Sentinelle Sécurité' },
    rccm: { old: null, new: 'CI-ABJ-2020-B-1' },
    service_type_ids: { old: [1], new: [1, 2] },
  },
  status: 'pending',
  created_at: '2026-10-02T09:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListChangeRequests.mockResolvedValue(page([request]));
  api.getReferenceData.mockResolvedValue(REFERENCE);
  api.adminApproveChangeRequest.mockResolvedValue(undefined);
  api.adminRejectChangeRequest.mockResolvedValue(undefined);
});

describe('demandes de modification', () => {
  it('charge les demandes en attente et affiche l’ancien → nouveau', async () => {
    render(<AdminChangeRequestsView />);
    const link = await screen.findByRole('link', { name: 'Sentinelle Sécurité' });
    expect(link).toHaveAttribute('href', '/admin/etablissements/provider/7');
    expect(api.adminListChangeRequests).toHaveBeenCalledWith({ status: 'pending', page: 1 });
    expect(screen.getByText('Raison sociale')).toBeInTheDocument();
    expect(screen.getByText('Numéro RCCM')).toBeInTheDocument();
    expect(screen.getByText('(vide)')).toBeInTheDocument();
    expect(screen.getByText('CI-ABJ-2020-B-1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Gardiennage, Alarme')).toBeInTheDocument());
  });

  it('change de filtre', async () => {
    const u = userEvent.setup();
    render(<AdminChangeRequestsView />);
    await screen.findByRole('link', { name: 'Sentinelle Sécurité' });
    await u.selectOptions(screen.getByLabelText('Statut des demandes'), 'rejected');
    expect(api.adminListChangeRequests).toHaveBeenLastCalledWith({ status: 'rejected', page: 1 });
  });

  it('approuve après confirmation puis rafraîchit', async () => {
    const u = userEvent.setup();
    render(<AdminChangeRequestsView />);
    await u.click(await screen.findByRole('button', { name: 'Approuver' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(api.adminApproveChangeRequest).toHaveBeenCalledWith(3));
    await waitFor(() => expect(api.adminListChangeRequests).toHaveBeenCalledTimes(2));
  });

  it('rejette avec un motif d’au moins 10 caractères', async () => {
    const u = userEvent.setup();
    render(<AdminChangeRequestsView />);
    await u.click(await screen.findByRole('button', { name: 'Rejeter' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Rejeter' });
    await u.type(within(dialog).getByLabelText(/Motif du rejet/), 'court');
    expect(submit).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Motif du rejet/), ' mais suffisant');
    await u.click(submit);
    await waitFor(() =>
      expect(api.adminRejectChangeRequest).toHaveBeenCalledWith(3, 'court mais suffisant'),
    );
  });

  it('un rejeu (409) n’affiche aucune erreur', async () => {
    api.adminApproveChangeRequest.mockRejectedValue(new ApiError(409, 'Déjà traitée.'));
    const u = userEvent.setup();
    render(<AdminChangeRequestsView />);
    await u.click(await screen.findByRole('button', { name: 'Approuver' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(api.adminListChangeRequests).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Déjà traitée.')).not.toBeInTheDocument();
  });

  it('état vide', async () => {
    api.adminListChangeRequests.mockResolvedValue(page([]));
    render(<AdminChangeRequestsView />);
    expect(await screen.findByText('Aucune demande')).toBeInTheDocument();
  });
});

describe('formatChangeValue', () => {
  it('rend les valeurs en texte lisible', () => {
    expect(formatChangeValue('x', null)).toBe('(vide)');
    expect(formatChangeValue('x', true)).toBe('Oui');
    expect(formatChangeValue('x', [])).toBe('(vide)');
    expect(formatChangeValue('force_type_id', 1, REFERENCE)).toBe('Police');
    expect(formatChangeValue('service_type_ids', [2, 9], REFERENCE)).toBe('Alarme, n° 9');
  });
});
