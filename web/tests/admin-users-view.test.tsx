import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AdminUser } from '@/lib/api/types';

const api = vi.hoisted(() => ({
  adminListUsers: vi.fn(),
  adminUpdateUser: vi.fn(),
  adminAnonymizeUser: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ user: { id: 999 } }),
}));

import { AdminUsersView } from '@/components/admin/users/AdminUsersView';

function user(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 1,
    first_name: 'Awa',
    last_name: 'Kone',
    email: 'awa@example.test',
    phone: null,
    role: 'user',
    is_active: true,
    email_verified: true,
    two_factor_enabled: false,
    last_login_at: null,
    created_at: '2026-01-01T10:00:00Z',
    establishments_count: 2,
    ...over,
  };
}
const page = (data: AdminUser[]) => ({
  data,
  meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length },
  links: { next: null, prev: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListUsers.mockResolvedValue(page([user()]));
});

describe('AdminUsersView', () => {
  it('transmet les filtres à l’API', async () => {
    const u = userEvent.setup();
    render(<AdminUsersView />);
    expect(await screen.findByText('Awa Kone')).toBeInTheDocument();
    expect(api.adminListUsers).toHaveBeenLastCalledWith({ page: 1 });
    await u.type(screen.getByLabelText('Nom ou e-mail'), ' awa ');
    await u.selectOptions(screen.getByLabelText('Rôle'), 'editor');
    await u.selectOptions(screen.getByLabelText('Statut du compte'), '0');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() =>
      expect(api.adminListUsers).toHaveBeenLastCalledWith({
        page: 1,
        q: 'awa',
        role: 'editor',
        is_active: false,
      }),
    );
    await u.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => expect(api.adminListUsers).toHaveBeenLastCalledWith({ page: 1 }));
  });

  it('change le rôle après confirmation et met la ligne à jour', async () => {
    const u = userEvent.setup();
    api.adminUpdateUser.mockResolvedValue(user({ role: 'editor' }));
    render(<AdminUsersView />);
    await u.click(await screen.findByRole('button', { name: 'Changer le rôle de Awa Kone' }));
    await u.selectOptions(screen.getByLabelText('Nouveau rôle'), 'editor');
    expect(api.adminUpdateUser).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Confirmer le changement' }));
    await waitFor(() => expect(api.adminUpdateUser).toHaveBeenCalledWith(1, { role: 'editor' }));
    expect(await screen.findByText('Éditeur', { selector: 'td' })).toBeInTheDocument();
  });

  it('affiche l’erreur « dernier admin » sans fermer la boîte ni casser la liste', async () => {
    const u = userEvent.setup();
    api.adminUpdateUser.mockRejectedValue(
      new ApiError(422, 'Données invalides.', {
        role: ['Impossible de retirer le dernier administrateur.'],
      }),
    );
    render(<AdminUsersView />);
    await u.click(await screen.findByRole('button', { name: 'Changer le rôle de Awa Kone' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer le changement' }));
    expect(
      await screen.findByText('Impossible de retirer le dernier administrateur.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Awa Kone' })).toBeInTheDocument();
  });

  it('exige l’e-mail exact pour anonymiser', async () => {
    const u = userEvent.setup();
    api.adminAnonymizeUser.mockResolvedValue(undefined);
    render(<AdminUsersView />);
    await u.click(await screen.findByRole('button', { name: 'Anonymiser le compte de Awa Kone' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Anonymiser définitivement' });
    expect(confirm).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Adresse e-mail du compte/), 'awa@example.tes');
    expect(confirm).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Adresse e-mail du compte/), 't');
    expect(confirm).toBeEnabled();
    await u.click(confirm);
    await waitFor(() =>
      expect(api.adminAnonymizeUser).toHaveBeenCalledWith(1, 'awa@example.test'),
    );
  });

  it('confirme la désactivation et n’envoie qu’un appel malgré un double clic', async () => {
    const u = userEvent.setup();
    let resolve!: (v: AdminUser) => void;
    api.adminUpdateUser.mockReturnValue(new Promise<AdminUser>((r) => (resolve = r)));
    render(<AdminUsersView />);
    await u.click(await screen.findByRole('button', { name: 'Désactiver le compte de Awa Kone' }));
    expect(api.adminUpdateUser).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Désactiver' });
    await u.dblClick(confirm);
    expect(api.adminUpdateUser).toHaveBeenCalledTimes(1);
    expect(api.adminUpdateUser).toHaveBeenCalledWith(1, { is_active: false });
    resolve(user({ is_active: false }));
    expect(await screen.findByText('Inactif')).toBeInTheDocument();
  });
});
