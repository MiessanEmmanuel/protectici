import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AdminReferenceItem } from '@/lib/api/types';

const api = vi.hoisted(() => ({
  adminListReference: vi.fn(),
  adminCreateReference: vi.fn(),
  adminUpdateReference: vi.fn(),
  adminDeleteReference: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));

import { AdminReferenceView } from '@/components/admin/reference/AdminReferenceView';

function item(over: Partial<AdminReferenceItem> = {}): AdminReferenceItem {
  return { id: 1, name: 'Abidjan', slug: 'abidjan', sort_order: 1, is_visible: true, ...over };
}
const page = (data: AdminReferenceItem[]) => ({
  data,
  meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length },
  links: { next: null, prev: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListReference.mockImplementation(async (resource: string) =>
    resource === 'service-types'
      ? page([item({ id: 7, name: 'Gardiennage', slug: 'gardiennage' })])
      : page([item()]),
  );
});

describe('AdminReferenceView', () => {
  it('liste la première ressource puis change de ressource', async () => {
    const u = userEvent.setup();
    render(<AdminReferenceView />);
    expect(screen.getByRole('heading', { level: 1, name: 'Référentiels' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Abidjan' })).toBeInTheDocument();
    expect(api.adminListReference).toHaveBeenCalledWith('cities', 1);
    await u.click(screen.getByRole('tab', { name: 'Types de service' }));
    expect(await screen.findByRole('cell', { name: 'Gardiennage' })).toBeInTheDocument();
    expect(api.adminListReference).toHaveBeenCalledWith('service-types', 1);
  });

  it('valide puis crée une valeur', async () => {
    const u = userEvent.setup();
    api.adminCreateReference.mockResolvedValue(item({ id: 2, name: 'Bouaké' }));
    render(<AdminReferenceView />);
    await u.click(await screen.findByRole('button', { name: 'Ajouter une valeur' }));
    const dialog = screen.getByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Créer' }));
    expect(await within(dialog).findByText('Le nom est obligatoire.')).toBeInTheDocument();
    expect(api.adminCreateReference).not.toHaveBeenCalled();
    await u.type(within(dialog).getByLabelText(/^Nom/), 'Bouaké');
    await u.type(within(dialog).getByLabelText('Latitude'), '7.69');
    await u.click(within(dialog).getByRole('button', { name: 'Créer' }));
    expect(await within(dialog).findByText(/aucune des deux/)).toBeInTheDocument();
    await u.type(within(dialog).getByLabelText('Longitude'), '-5.03');
    await u.click(within(dialog).getByRole('button', { name: 'Créer' }));
    await waitFor(() =>
      expect(api.adminCreateReference).toHaveBeenCalledWith('cities', {
        name: 'Bouaké',
        sort_order: 0,
        is_visible: true,
        description: null,
        lat: 7.69,
        lng: -5.03,
      }),
    );
  });

  it('masque une valeur via PATCH is_visible', async () => {
    const u = userEvent.setup();
    api.adminUpdateReference.mockResolvedValue(item({ is_visible: false }));
    render(<AdminReferenceView />);
    await u.click(await screen.findByRole('button', { name: 'Masquer Abidjan' }));
    await waitFor(() =>
      expect(api.adminUpdateReference).toHaveBeenCalledWith('cities', 1, { is_visible: false }),
    );
  });

  it('supprime seulement avec le nom exact', async () => {
    const u = userEvent.setup();
    api.adminDeleteReference.mockResolvedValue(undefined);
    render(<AdminReferenceView />);
    await u.click(await screen.findByRole('button', { name: 'Supprimer Abidjan' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer' });
    expect(confirm).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Nom de la valeur/), 'abidjan');
    expect(confirm).toBeDisabled();
    await u.clear(within(dialog).getByLabelText(/Nom de la valeur/));
    await u.type(within(dialog).getByLabelText(/Nom de la valeur/), 'Abidjan');
    await u.click(confirm);
    await waitFor(() => expect(api.adminDeleteReference).toHaveBeenCalledWith('cities', 1));
  });

  it('affiche le 409 avec « Masquer plutôt »', async () => {
    const u = userEvent.setup();
    api.adminDeleteReference.mockRejectedValue(
      new ApiError(409, 'Valeur utilisée, masquez-la plutôt.'),
    );
    api.adminUpdateReference.mockResolvedValue(item({ is_visible: false }));
    render(<AdminReferenceView />);
    await u.click(await screen.findByRole('button', { name: 'Supprimer Abidjan' }));
    await u.type(screen.getByLabelText(/Nom de la valeur/), 'Abidjan');
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText(/Valeur utilisée, masquez-la plutôt\./)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Masquer plutôt' }));
    await waitFor(() =>
      expect(api.adminUpdateReference).toHaveBeenCalledWith('cities', 1, { is_visible: false }),
    );
  });
});
