import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { establishment, REFERENCE } from './admin-establishments-fixtures';

const { push, api } = vi.hoisted(() => ({
  push: vi.fn(),
  api: {
    adminGetEstablishment: vi.fn(),
    adminEstablishmentAction: vi.fn(),
    adminUpdateEstablishment: vi.fn(),
    adminDeleteEstablishment: vi.fn(),
    adminDownloadDocument: vi.fn(),
    getReferenceData: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));
vi.mock('@/components/map/MiniMap', () => ({ MiniMap: () => <div>carte</div> }));
vi.mock('@/components/establishment/LocationFields', () => ({ LocationFields: () => <div>localisation</div> }));

import { AdminEstablishmentDetail } from '@/components/admin/etablissements/AdminEstablishmentDetail';
import { computePatch, toDraft } from '@/components/admin/etablissements/AdminEstablishmentEditForm';
import notFoundGuard from '@/app/admin/etablissements/[type]/[id]/page';

function buttons() {
  return screen
    .getAllByRole('button')
    .map((b) => b.textContent)
    .filter(Boolean);
}

async function load(over = {}) {
  api.adminGetEstablishment.mockResolvedValue(establishment(over));
  render(<AdminEstablishmentDetail type="provider" id={7} />);
  await screen.findByRole('heading', { level: 1, name: /Sentinelle Sécurité/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getReferenceData.mockResolvedValue(REFERENCE);
  api.adminEstablishmentAction.mockResolvedValue(undefined);
  api.adminDownloadDocument.mockResolvedValue(new Blob(['x'], { type: 'application/pdf' }));
});

describe('fiche admin : affichage', () => {
  it('montre propriétaire, légal, dirigeants, justificatifs, demandes et historique', async () => {
    await load();
    expect(screen.getByText('awa@example.test')).toBeInTheDocument();
    expect(screen.getByText('CI-ABJ-2019-B-0001')).toBeInTheDocument();
    expect(screen.getByText('Awa Koné', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Masqué')).toBeInTheDocument();
    expect(screen.getByText('rccm.pdf')).toBeInTheDocument();
    expect(screen.getByText(/journalisé/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Logo Sentinelle' })).toBeInTheDocument();
    expect(screen.getByText('Fiche soumise')).toBeInTheDocument();
    expect(screen.getAllByText('Nouvelle valeur').length).toBe(2);
    expect(screen.getByText('(vide)')).toBeInTheDocument();
    expect(screen.getByText('Gardiennage, Alarme')).toBeInTheDocument();
  });

  it('affiche une fiche introuvable (404)', async () => {
    api.adminGetEstablishment.mockRejectedValue(new ApiError(404, 'Introuvable.'));
    render(<AdminEstablishmentDetail type="provider" id={9} />);
    expect(await screen.findByText('Introuvable')).toBeInTheDocument();
  });
});

describe('fiche admin : boutons selon le statut', () => {
  it('en attente : approuver, rejeter, pas de rétablissement', async () => {
    await load();
    expect(buttons()).toEqual(
      expect.arrayContaining(['Approuver', 'Rejeter', 'Mettre en avant', 'Modifier', 'Supprimer']),
    );
    expect(buttons()).not.toContain('Suspendre');
    expect(buttons()).not.toContain('Rétablir');
    expect(buttons()).not.toContain('Vérifier');
  });

  it('validée : suspendre et vérifier ; vérifiée : retirer la vérification', async () => {
    await load({ status: 'approved', is_visible: true });
    expect(buttons()).toEqual(expect.arrayContaining(['Suspendre', 'Vérifier']));
    expect(buttons()).not.toContain('Approuver');
  });

  it('suspendue : rétablir', async () => {
    await load({ status: 'suspended' });
    expect(buttons()).toContain('Rétablir');
    expect(buttons()).not.toContain('Suspendre');
  });

  it('vérifiée : retirer la vérification', async () => {
    await load({ status: 'approved', is_verified: true });
    expect(buttons()).toContain('Retirer la vérification');
    expect(buttons()).not.toContain('Vérifier');
  });

  it('une force étatique n’a pas de vérification', async () => {
    api.adminGetEstablishment.mockResolvedValue(establishment({ type: 'state_force', status: 'approved' }));
    render(<AdminEstablishmentDetail type="state_force" id={7} />);
    await screen.findByRole('heading', { level: 1 });
    expect(buttons()).not.toContain('Vérifier');
  });
});

describe('fiche admin : actions', () => {
  it('rejeter exige un motif d’au moins 10 caractères', async () => {
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Rejeter' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Rejeter' });
    await u.type(within(dialog).getByLabelText(/Motif du rejet/), 'court');
    expect(submit).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Motif du rejet/), ' et maintenant long');
    expect(submit).toBeEnabled();
    await u.click(submit);
    await waitFor(() =>
      expect(api.adminEstablishmentAction).toHaveBeenCalledWith(
        'provider',
        7,
        'reject',
        'court et maintenant long',
      ),
    );
    await waitFor(() => expect(api.adminGetEstablishment).toHaveBeenCalledTimes(2)); // rechargée
  });

  it('approuver : un double clic = un seul appel ; un rejeu ne produit aucune erreur', async () => {
    let release: () => void = () => undefined;
    api.adminEstablishmentAction.mockImplementation(() => new Promise<void>((r) => (release = r)));
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Approuver' }));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Approuver' });
    await u.dblClick(confirm);
    expect(api.adminEstablishmentAction).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.getByText('Fiche approuvée.')).toBeInTheDocument());

    // Rejeu (fiche encore affichée « en attente » car la réponse est identique) : pas d'erreur.
    api.adminEstablishmentAction.mockResolvedValue(undefined);
    await u.click(await screen.findByRole('button', { name: 'Approuver' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(api.adminEstablishmentAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert', { name: '' })?.textContent ?? '').toBe('');
  });

  it('un 409 s’affiche clairement dans la boîte', async () => {
    api.adminEstablishmentAction.mockRejectedValue(new ApiError(409, 'La fiche est déjà suspendue.'));
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Approuver' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approuver' }));
    expect(await screen.findByText('La fiche est déjà suspendue.')).toBeInTheDocument();
  });

  it('un 404 sur une action donne un message clair', async () => {
    api.adminEstablishmentAction.mockRejectedValue(new ApiError(404, 'x'));
    const u = userEvent.setup();
    await load({ status: 'suspended' });
    await u.click(screen.getByRole('button', { name: 'Rétablir' }));
    expect(await screen.findByText(/introuvable : elle a peut-être été supprimée/)).toBeInTheDocument();
  });

  it('supprimer exige le nom exact puis revient à la liste', async () => {
    api.adminDeleteEstablishment.mockResolvedValue(undefined);
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Supprimer' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: /Supprimer définitivement/ });
    const input = within(dialog).getByLabelText(/Nom de la fiche/);
    await u.type(input, 'Sentinelle');
    expect(submit).toBeDisabled();
    await u.clear(input);
    await u.type(input, 'Sentinelle Sécurité');
    await u.click(submit);
    await waitFor(() =>
      expect(api.adminDeleteEstablishment).toHaveBeenCalledWith('provider', 7, 'Sentinelle Sécurité'),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/etablissements'));
  });

  it('mettre en avant envoie is_featured', async () => {
    api.adminUpdateEstablishment.mockResolvedValue(establishment({ is_featured: true }));
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Mettre en avant' }));
    await waitFor(() =>
      expect(api.adminUpdateEstablishment).toHaveBeenCalledWith('provider', 7, { is_featured: true }),
    );
    expect(await screen.findByRole('button', { name: 'Retirer de la une' })).toBeInTheDocument();
  });

  it('télécharger un justificatif appelle adminDownloadDocument', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Télécharger rccm.pdf' }));
    await waitFor(() => expect(api.adminDownloadDocument).toHaveBeenCalledWith(55));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});

describe('édition admin', () => {
  it('computePatch n’envoie que les champs modifiés (null pour un champ vidé)', async () => {
    const e = establishment();
    const initial = toDraft(e);
    expect(computePatch(initial, initial, { initial: false, current: false })).toEqual({});
    const patch = computePatch(
      initial,
      { ...initial, name: 'Nouveau nom', legal_form: '', executives: [] },
      { initial: false, current: true },
    );
    expect(patch).toEqual({ name: 'Nouveau nom', legal_form: null, executives: [], is_featured: true });
  });

  it('enregistre uniquement ce qui change', async () => {
    api.adminUpdateEstablishment.mockResolvedValue(establishment({ name: 'Autre nom' }));
    const u = userEvent.setup();
    await load();
    await u.click(screen.getByRole('button', { name: 'Modifier' }));
    const name = await screen.findByLabelText(/Raison sociale/);
    await u.clear(name);
    await u.type(name, 'Autre nom');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() =>
      expect(api.adminUpdateEstablishment).toHaveBeenCalledWith('provider', 7, { name: 'Autre nom' }),
    );
  });
});

describe('page [type]/[id]', () => {
  it('refuse un type ou un identifiant invalide', async () => {
    await expect(notFoundGuard({ params: Promise.resolve({ type: 'x', id: '1' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(notFoundGuard({ params: Promise.resolve({ type: 'provider', id: '0' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(notFoundGuard({ params: Promise.resolve({ type: 'provider', id: '1e3' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(notFoundGuard({ params: Promise.resolve({ type: 'state_force', id: '12' }) })).resolves.toBeTruthy();
  });
});
