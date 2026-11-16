import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminImport, AdminImportRow } from '@/lib/api/imports';
import type { Paginated } from '@/lib/api/types';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  rows: vi.fn(),
  upload: vi.fn(),
  decide: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/lib/api/imports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/imports')>();
  return { ...actual, importsApi: api };
});
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/admin' }));
const listEstablishments = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: { adminListEstablishments: (q: unknown) => listEstablishments(q) },
}));

import { AdminImportStart } from '@/components/admin/imports/AdminImportStart';
import { AdminImportDetail } from '@/components/admin/imports/AdminImportDetail';
import { AdminEstablishmentsList } from '@/components/admin/etablissements/AdminEstablishmentsList';
import { ApiError } from '@/lib/api/errors';
import { ADMIN_NAV, IMPORTS_ENABLED } from '@/lib/admin-access';
import { page, row as establishmentRow } from './admin-establishments-fixtures';

function imp(over: Partial<AdminImport> = {}): AdminImport {
  return {
    id: 5,
    type: 'state_force',
    status: 'ready',
    publish_mode: 'publish',
    original_name: 'forces.xlsx',
    rows_total: 12,
    rows_valid: 8,
    rows_invalid: 2,
    rows_duplicate: 2,
    rows_created: 0,
    failure_message: null,
    created_by: { id: 1, name: 'Admin Démo' },
    created_at: '2026-10-20T09:00:00Z',
    confirmed_at: null,
    finished_at: null,
    cancelled_at: null,
    can_confirm: true,
    can_cancel: true,
    ...over,
  };
}

function importRow(over: Partial<AdminImportRow> = {}): AdminImportRow {
  return {
    line: 2,
    name: 'Commissariat du Plateau',
    city: 'Abidjan',
    status: 'valid',
    errors: [],
    duplicate_of: null,
    decision: null,
    ...over,
  };
}

function rowsPage(data: AdminImportRow[]): Paginated<AdminImportRow> {
  return page(data);
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  listEstablishments.mockReset();
  api.list.mockResolvedValue(page([imp({ status: 'done', rows_created: 8 })]));
  api.rows.mockImplementation((_id: number, q: { status: string }) => {
    if (q.status === 'invalid') {
      return Promise.resolve(
        rowsPage([
          importRow({
            line: 10,
            status: 'invalid',
            city: null,
            errors: [{ column: 'Ville', message: 'Ville inconnue : Abidajn' }],
          }),
        ]),
      );
    }
    if (q.status === 'duplicate') {
      return Promise.resolve(
        rowsPage([
          importRow({
            line: 12,
            status: 'duplicate',
            decision: 'skip',
            duplicate_of: { type: 'state_force', id: 3, name: 'Commissariat du Plateau', city: 'Abidjan', reason: 'name_city' },
          }),
        ]),
      );
    }
    return Promise.resolve(rowsPage([importRow()]));
  });
});

describe('écran de démarrage de l’import', () => {
  it('propose le modèle du type choisi et affiche l’historique', async () => {
    const u = userEvent.setup();
    render(<AdminImportStart />);
    const link = screen.getByRole('link', { name: /Télécharger le modèle/ });
    expect(link.getAttribute('href')).toMatch(/\/api\/v1\/admin\/establishment-imports\/template\/state_force$/);
    await u.click(screen.getByLabelText('Prestataires privés'));
    expect(link.getAttribute('href')).toMatch(/template\/provider$/);
    const history = await screen.findByRole('table', { name: 'Historique des imports' });
    expect(within(history).getByRole('link', { name: 'forces.xlsx' })).toHaveAttribute(
      'href',
      '/admin/etablissements/import/5',
    );
  });

  it('exige un fichier puis téléverse avec le type et le mode, et ouvre le suivi', async () => {
    const u = userEvent.setup();
    api.upload.mockResolvedValue(imp({ id: 9, status: 'analyzing' }));
    render(<AdminImportStart />);
    await u.click(screen.getByRole('button', { name: /Téléverser et analyser/ }));
    expect(await screen.findByText('Choisissez le fichier Excel rempli.')).toBeInTheDocument();
    expect(api.upload).not.toHaveBeenCalled();

    const file = new File(['x'], 'liste.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await u.upload(screen.getByLabelText(/Classeur Excel/), file);
    await u.click(screen.getByLabelText('À valider'));
    await u.click(screen.getByRole('button', { name: /Téléverser et analyser/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/etablissements/import/9'));
    expect(api.upload).toHaveBeenCalledWith({ type: 'state_force', publish_mode: 'pending', file });
  });

  it('affiche l’erreur de validation du fichier renvoyée par l’API', async () => {
    const u = userEvent.setup();
    api.upload.mockRejectedValue(
      new ApiError(422, 'Données invalides.', { file: ['Le fichier dépasse 2 000 lignes.'] }),
    );
    render(<AdminImportStart />);
    const file = new File(['x'], 'liste.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await u.upload(screen.getByLabelText(/Classeur Excel/), file);
    await u.click(screen.getByRole('button', { name: /Téléverser et analyser/ }));
    expect(await screen.findByText('Le fichier dépasse 2 000 lignes.')).toBeInTheDocument();
  });
});

describe('suivi d’un import', () => {
  it('se rafraîchit pendant l’analyse puis affiche les compteurs', async () => {
    api.get
      .mockResolvedValueOnce(imp({ status: 'analyzing', rows_total: 0, rows_valid: 0, rows_invalid: 0, rows_duplicate: 0, can_confirm: false, can_cancel: false }))
      .mockResolvedValue(imp());
    render(<AdminImportDetail id={5} />);
    expect(await screen.findByText(/Analyse du fichier en cours/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(await screen.findByText(/Analyse terminée/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('tab', { name: 'Erreurs (2)' })).toBeInTheDocument();
  });

  it('affiche les erreurs et le lien du rapport', async () => {
    api.get.mockResolvedValue(imp());
    const u = userEvent.setup();
    render(<AdminImportDetail id={5} />);
    await u.click(await screen.findByRole('tab', { name: 'Erreurs (2)' }));
    expect(await screen.findByText(/Ville inconnue : Abidajn/)).toBeInTheDocument();
    expect(api.rows).toHaveBeenLastCalledWith(5, { status: 'invalid', page: 1, per_page: 25 });
    expect(screen.getByRole('link', { name: /rapport d’erreurs/ }).getAttribute('href')).toMatch(
      /establishment-imports\/5\/report$/,
    );
  });

  it('enregistre la décision sur un doublon', async () => {
    api.get.mockResolvedValue(imp());
    api.decide.mockResolvedValue(imp());
    const u = userEvent.setup();
    render(<AdminImportDetail id={5} />);
    await u.click(await screen.findByRole('tab', { name: 'Doublons (2)' }));
    const create = await screen.findByLabelText('Créer quand même');
    expect(screen.getByLabelText('Ignorer')).toBeChecked();
    await u.click(create);
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(5, [{ line: 12, decision: 'create' }]));
    await waitFor(() => expect(screen.getByLabelText('Créer quand même')).toBeChecked());
    expect(screen.getByRole('link', { name: 'Commissariat du Plateau' })).toHaveAttribute(
      'href',
      '/admin/etablissements/state_force/3',
    );
  });

  it('désactive la confirmation quand rien n’est à créer', async () => {
    api.get.mockResolvedValue(imp({ can_confirm: false }));
    render(<AdminImportDetail id={5} />);
    expect(await screen.findByRole('button', { name: 'Confirmer l’import' })).toBeDisabled();
  });

  it('demande une confirmation explicite avant de créer les fiches', async () => {
    api.get.mockResolvedValue(imp());
    api.confirm.mockResolvedValue(imp({ status: 'done', rows_created: 8, can_confirm: false }));
    const u = userEvent.setup();
    render(<AdminImportDetail id={5} />);
    await u.click(await screen.findByRole('button', { name: 'Confirmer l’import' }));
    expect(api.confirm).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/publiées et visibles immédiatement/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Créer les fiches' }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(5));
    expect(await screen.findByText('Import terminé : 8 fiches créées.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les fiches de cet import' })).toHaveAttribute(
      'href',
      '/admin/etablissements?import_id=5',
    );
  });

  it('explique ce que l’annulation supprime puis annonce le résultat', async () => {
    api.get.mockResolvedValue(imp({ status: 'done', rows_created: 8, can_confirm: false }));
    api.cancel.mockResolvedValue({
      data: imp({ status: 'done', rows_created: 8, can_confirm: false, can_cancel: false, cancelled_at: '2026-10-21T10:00:00Z' }),
      deleted_count: 6,
    });
    const u = userEvent.setup();
    render(<AdminImportDetail id={5} />);
    await u.click(await screen.findByRole('button', { name: 'Annuler l’import' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/ni propriétaire ni avis/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Annuler l’import' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith(5));
    expect(await screen.findByText('6 fiches supprimées.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler l’import' })).not.toBeInTheDocument();
  });

  it('affiche le message d’échec', async () => {
    api.get.mockResolvedValue(
      imp({ status: 'failed', rows_total: 0, failure_message: 'En-têtes obligatoires absents.', can_confirm: false }),
    );
    render(<AdminImportDetail id={5} />);
    expect(await screen.findByText('En-têtes obligatoires absents.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmer l’import' })).not.toBeInTheDocument();
  });
});

describe('import désactivé tant que l’API n’existe pas (R05)', () => {
  it('ni bouton, ni filtre « Lot d’import », ni appel à l’API d’import', async () => {
    expect(IMPORTS_ENABLED).toBe(false);
    listEstablishments.mockResolvedValue(page([establishmentRow()]));
    render(<AdminEstablishmentsList initialImportId={5} />);
    await waitFor(() => expect(listEstablishments).toHaveBeenCalled());
    expect(listEstablishments).toHaveBeenCalledWith({ sort: '-submitted_at', page: 1 });
    expect(screen.queryByLabelText('Lot d’import')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Importer un fichier/ })).not.toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
    expect(ADMIN_NAV.some((i) => i.href === '/admin/etablissements/import')).toBe(false);
  });
});

// Le module reste testé (composants montés directement, `importsEnabled` forcé) pour sa réactivation.
describe('filtres de la liste des établissements', () => {
  it('filtre sur le lot d’import lu depuis l’URL et signale les fiches incomplètes', async () => {
    listEstablishments.mockResolvedValue(page([establishmentRow({ is_incomplete: true, import_id: 5 })]));
    const u = userEvent.setup();
    render(<AdminEstablishmentsList initialImportId={5} importsEnabled />);
    expect(await screen.findByText('Incomplète')).toBeInTheDocument();
    expect(listEstablishments).toHaveBeenCalledWith({ sort: '-submitted_at', page: 1, import_id: 5 });
    await u.click(screen.getByLabelText('Fiches incomplètes seulement'));
    expect(listEstablishments).toHaveBeenLastCalledWith({
      sort: '-submitted_at',
      page: 1,
      import_id: 5,
      incomplete: true,
    });
    expect(screen.getByRole('link', { name: /Importer un fichier/ })).toHaveAttribute(
      'href',
      '/admin/etablissements/import',
    );
  });
});
