import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, row } from './admin-establishments-fixtures';

const list = vi.fn();
vi.mock('@/lib/api/client', () => ({ clientApi: { adminListEstablishments: (q: unknown) => list(q) } }));

import { AdminEstablishmentsList } from '@/components/admin/etablissements/AdminEstablishmentsList';
import AdminEstablishmentsPage from '@/app/admin/etablissements/page';
import { ApiError } from '@/lib/api/errors';

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue(page([row()]));
});

describe('liste admin des établissements', () => {
  it('affiche les colonnes demandées et le lien vers la fiche', async () => {
    render(<AdminEstablishmentsList />);
    const link = await screen.findByRole('link', { name: 'Sentinelle Sécurité' });
    expect(link).toHaveAttribute('href', '/admin/etablissements/provider/7');
    expect(screen.getByText('awa@example.test')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('En attente de validation')).toBeInTheDocument();
    expect(screen.getByText('À la une')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ sort: '-submitted_at', page: 1 });
  });

  it('transmet les valeurs initiales (liens du tableau de bord)', async () => {
    render(<AdminEstablishmentsList initialType="state_force" initialStatus="pending" />);
    await screen.findByRole('table');
    expect(list).toHaveBeenCalledWith({ type: 'state_force', status: 'pending', sort: '-submitted_at', page: 1 });
  });

  it('envoie les bons paramètres pour filtres, recherche et tri', async () => {
    const u = userEvent.setup();
    render(<AdminEstablishmentsList />);
    await screen.findByRole('table');
    await u.selectOptions(screen.getByLabelText('Type'), 'provider');
    await u.selectOptions(screen.getByLabelText('Statut'), 'approved');
    await u.selectOptions(screen.getByLabelText('Tri'), 'name');
    await u.type(screen.getByLabelText('Recherche'), '  sentinelle ');
    await u.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(list).toHaveBeenLastCalledWith({
      type: 'provider',
      status: 'approved',
      sort: 'name',
      q: 'sentinelle',
      page: 1,
    });
  });

  it('pagine', async () => {
    list.mockResolvedValue(page([row()], { current_page: 1, last_page: 3, total: 50 }));
    const u = userEvent.setup();
    render(<AdminEstablishmentsList />);
    await u.click(await screen.findByRole('button', { name: 'Suivant' }));
    expect(list).toHaveBeenLastCalledWith({ sort: '-submitted_at', page: 2 });
  });

  it('affiche l’état vide et l’erreur', async () => {
    list.mockResolvedValue(page([]));
    const { unmount } = render(<AdminEstablishmentsList />);
    expect(await screen.findByText('Aucun établissement')).toBeInTheDocument();
    unmount();
    list.mockRejectedValue(new ApiError(403, 'Accès refusé.'));
    render(<AdminEstablishmentsList />);
    expect(await screen.findByText('Accès refusé.')).toBeInTheDocument();
  });
});

describe('page /admin/etablissements', () => {
  it('ne retient que les valeurs de la liste blanche', async () => {
    render(
      await AdminEstablishmentsPage({
        searchParams: Promise.resolve({ type: 'provider', status: '<script>' }),
      }),
    );
    await screen.findByRole('table');
    expect(list).toHaveBeenCalledWith({ type: 'provider', sort: '-submitted_at', page: 1 });
  });
});
