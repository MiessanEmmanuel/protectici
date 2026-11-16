import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { ReferenceData } from '@/lib/api/types';
import { chooseOption } from './select-helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/espace-prestataire',
}));
vi.mock('@/components/map/MapPicker', () => ({ MapPicker: () => null }));

let EstablishmentManager: typeof import('@/components/establishment/EstablishmentManager').EstablishmentManager;
let MyEstablishmentsList: typeof import('@/components/establishment/MyEstablishmentsList').MyEstablishmentsList;
let clientApi: typeof import('@/lib/api/client').clientApi;
let reference: ReferenceData;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ({ clientApi } = await import('@/lib/api/client'));
  ({ EstablishmentManager } = await import('@/components/establishment/EstablishmentManager'));
  ({ MyEstablishmentsList } = await import('@/components/establishment/MyEstablishmentsList'));
  reference = await clientApi.getReferenceData();
  await clientApi.login({ email: 'prestataire@example.test', password: 'motdepasse' });
});

afterEach(() => vi.restoreAllMocks());

const SENSITIVE = [
  'name',
  'rccm',
  'legal_form',
  'share_capital',
  'corporate_purpose',
  'approval_number',
  'force_type_id',
];

function manager(slug: string, type: 'provider' | 'state_force' = 'provider') {
  return render(<EstablishmentManager type={type} slug={slug} reference={reference} />);
}

describe('espace prestataire : liste', () => {
  it('affiche les deux fiches, le motif de rejet et les liens de gestion', async () => {
    render(<MyEstablishmentsList />);
    expect(await screen.findByText('Phoenix Protection')).toBeInTheDocument();
    expect(screen.getByText('Garde Lagune Sécurité')).toBeInTheDocument();
    expect(screen.getByText(/numéro d'agrément fourni est illisible/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gérer Phoenix Protection' })).toHaveAttribute(
      'href',
      '/espace-prestataire/provider/phoenix-protection',
    );
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
    expect(screen.getByText('En attente de validation')).toBeInTheDocument();
  });

  it('affiche un état vide avec invitation à s’inscrire', async () => {
    vi.spyOn(clientApi, 'listMyEstablishments').mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 12, total: 0 },
      links: { next: null, prev: null },
    });
    render(<MyEstablishmentsList />);
    expect(await screen.findByText(/aucun établissement/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inscrire mon établissement' })).toHaveAttribute(
      'href',
      '/inscription-etablissement',
    );
  });
});

describe('espace prestataire : fiche rejetée', () => {
  it('montre le motif et permet de soumettre à nouveau après confirmation', async () => {
    const u = userEvent.setup();
    const resubmit = vi.spyOn(clientApi, 'resubmitEstablishment');
    manager('phoenix-protection');
    expect(await screen.findByText('Fiche rejetée')).toBeInTheDocument();
    expect(screen.getByText(/numéro d'agrément fourni est illisible/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Soumettre à nouveau' }));
    const dialog = screen.getByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Soumettre à nouveau' }));
    await waitFor(() => expect(resubmit).toHaveBeenCalledWith('provider', 'phoenix-protection'));
    expect(await screen.findByText('Fiche en attente de validation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soumettre à nouveau' })).not.toBeInTheDocument();
  });
});

describe('espace prestataire : fiche suspendue', () => {
  it('passe tout en lecture seule', async () => {
    const real = await clientApi.getMyEstablishment('provider', 'garde-lagune-securite');
    vi.spyOn(clientApi, 'getMyEstablishment').mockResolvedValue({ ...real, status: 'suspended' });
    manager('garde-lagune-securite');
    expect(await screen.findByText(/Fiche suspendue : lecture seule/)).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Enregistrer les modifications' }),
    ).not.toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: 'Médias' }));
    expect(screen.queryByRole('button', { name: 'Envoyer l’image' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: 'Modifications sensibles' }));
    expect(screen.getByRole('button', { name: 'Envoyer la demande' })).toBeDisabled();
    expect(screen.getByText(/aucune demande ne peut être envoyée/)).toBeInTheDocument();
  });
});

describe('espace prestataire : gestion d’une fiche', () => {
  it('enregistre les informations sans aucun champ sensible dans le PATCH', async () => {
    const u = userEvent.setup();
    const patch = vi.spyOn(clientApi, 'updateMyEstablishment');
    manager('garde-lagune-securite');
    const description = await screen.findByLabelText('Description');
    await u.clear(description);
    await u.type(description, 'Gardiennage de proximité à Marcory.');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Vos modifications ont été enregistrées.')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledTimes(1);
    const body = patch.mock.calls[0]![2];
    expect(body).toMatchObject({ description: 'Gardiennage de proximité à Marcory.' });
    for (const f of SENSITIVE) expect(body).not.toHaveProperty(f);
  });

  it('refuse un téléphone invalide côté client et affiche l’erreur du champ', async () => {
    const u = userEvent.setup();
    const patch = vi.spyOn(clientApi, 'updateMyEstablishment');
    manager('garde-lagune-securite');
    const phone = await screen.findByLabelText(/^Téléphone/);
    await u.clear(phone);
    await u.type(phone, '12');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect((await screen.findAllByText(/Numéro invalide/)).length).toBeGreaterThan(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it('enregistre les dirigeants en remplacement complet avec visibilité par dirigeant', async () => {
    const u = userEvent.setup();
    const patch = vi.spyOn(clientApi, 'updateMyEstablishment');
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Dirigeants' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter un dirigeant' }));
    await u.type(screen.getAllByLabelText(/Nom complet/)[1]!, 'Awa Koné');
    await chooseOption(u, screen.getAllByLabelText(/^Fonction/)[1]!, 'other');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les dirigeants' }));
    expect(await screen.findByText('Précisez la fonction.', { selector: 'p' })).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Intitulé de la fonction/), 'Directrice RH');
    await u.click(screen.getAllByLabelText(/Afficher ce dirigeant publiquement/)[1]!);
    await u.click(screen.getByRole('button', { name: 'Enregistrer les dirigeants' }));
    expect(
      await screen.findByText('La liste des dirigeants a été enregistrée.'),
    ).toBeInTheDocument();
    expect(patch.mock.calls[0]![2]).toEqual({
      executives: [
        {
          full_name: 'Yao Prestataire',
          position: 'general_manager',
          position_label: null,
          is_visible: true,
        },
        {
          full_name: 'Awa Koné',
          position: 'other',
          position_label: 'Directrice RH',
          is_visible: true,
        },
      ],
    });
  });

  it('agences : ajout, validation, envoi en remplacement complet et conservation des identifiants', async () => {
    const u = userEvent.setup();
    const patch = vi.spyOn(clientApi, 'updateMyEstablishment');
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Agences' }));
    expect(screen.getByText('Aucune agence renseignée pour le moment.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Ajouter une agence' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer les agences' }));
    expect(
      await screen.findByText('Le nom de l’agence est obligatoire.', { selector: 'li' }),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    await u.type(screen.getByLabelText(/Nom de l’agence/), 'Agence de Cocody');
    const city = reference.cities[0]!;
    await chooseOption(u, screen.getByLabelText(/Ville/), String(city.id));
    await u.type(screen.getByLabelText(/Téléphone de l’agence/), '07 09 44 51 22');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les agences' }));
    expect(await screen.findByText('La liste des agences a été enregistrée.')).toBeInTheDocument();
    expect(patch.mock.calls[0]![2]).toEqual({
      branches: [
        {
          label: 'Agence de Cocody',
          city_id: city.id,
          district_id: null,
          address: null,
          geo_description: null,
          phone: '+2250709445122',
          lat: null,
          lng: null,
        },
      ],
    });

    // Second envoi : l'agence créée garde l'identifiant renvoyé par le serveur.
    const created = (await patch.mock.results[0]!.value).branches[0];
    expect(created.id).toEqual(expect.any(Number));
    await u.click(screen.getByRole('button', { name: 'Enregistrer les agences' }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]![2]).toMatchObject({ branches: [{ id: created.id }] });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retirer Agence de Cocody' })).toBeEnabled(),
    );

    // Remise à zéro : la fiche factice est partagée avec les autres tests.
    await u.click(screen.getByRole('button', { name: 'Retirer Agence de Cocody' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer les agences' }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
    expect(patch.mock.calls[2]![2]).toEqual({ branches: [] });
  });

  it('agences : affiche les erreurs renvoyées par l’API', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'updateMyEstablishment').mockRejectedValue(
      new ApiError(422, 'Certaines informations sont invalides.', {
        'branches.0.district_id': ['Ce quartier n’appartient pas à la ville choisie.'],
      }),
    );
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Agences' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter une agence' }));
    await u.type(screen.getByLabelText(/Nom de l’agence/), 'Agence test');
    await chooseOption(u, screen.getByLabelText(/Ville/), String(reference.cities[0]!.id));
    await u.click(screen.getByRole('button', { name: 'Enregistrer les agences' }));
    expect(
      (await screen.findAllByText('Ce quartier n’appartient pas à la ville choisie.')).length,
    ).toBeGreaterThan(0);
  });

  it('agences : lecture seule sur une fiche suspendue, onglet absent pour une force étatique', async () => {
    const u = userEvent.setup();
    const real = await clientApi.getMyEstablishment('provider', 'garde-lagune-securite');
    const get = vi.spyOn(clientApi, 'getMyEstablishment');
    get.mockResolvedValue({ ...real, status: 'suspended' });
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Agences' }));
    expect(screen.getByRole('button', { name: 'Ajouter une agence' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Enregistrer les agences' }),
    ).not.toBeInTheDocument();
    cleanup();
    get.mockResolvedValue({ ...real, type: 'state_force', status: 'approved' });
    manager('garde-lagune-securite', 'state_force');
    await screen.findByRole('tab', { name: 'Informations' });
    expect(screen.queryByRole('tab', { name: 'Agences' })).not.toBeInTheDocument();
  });

  it('force étatique sans `executives` : la page s’ouvre et les horaires partent au format structuré (R02, R03)', async () => {
    const u = userEvent.setup();
    const real = await clientApi.getMyEstablishment('provider', 'garde-lagune-securite');
    const { executives: _omit, ...withoutExecutives } = real;
    void _omit;
    const force = {
      ...withoutExecutives,
      type: 'state_force' as const,
      status: 'approved' as const,
      force_type_id: reference.state_force_types[0]!.id,
      procedure_type_ids: [],
      opening_hours: { mon: [['08:00', '17:00']] as [string, string][] },
      is_open_24h: false,
    };
    vi.spyOn(clientApi, 'getMyEstablishment').mockResolvedValue(force);
    const patch = vi.spyOn(clientApi, 'updateMyEstablishment').mockResolvedValue(force);
    manager('garde-lagune-securite', 'state_force');
    expect(await screen.findByLabelText('Fermeture du lundi')).toHaveValue('17:00');
    await u.click(screen.getByRole('checkbox', { name: 'Samedi, jour ouvert' }));
    await u.clear(screen.getByLabelText('Fermeture du samedi'));
    await u.type(screen.getByLabelText('Fermeture du samedi'), '12:00');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0]![2]).toMatchObject({
      opening_hours: { mon: [['08:00', '17:00']], sat: [['08:00', '12:00']] },
      is_open_24h: false,
    });
  });

  it('exige un texte alternatif pour une image, puis l’affiche avec son alt', async () => {
    const u = userEvent.setup();
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Médias' }));
    const input = screen.getByLabelText('Ajouter une image (logo)');
    await u.upload(input, new File(['x'], 'logo.png', { type: 'image/png' }));
    const logoSection = screen.getByRole('region', { name: /Logo/ });
    await u.click(within(logoSection).getByRole('button', { name: 'Envoyer l’image' }));
    expect(
      await screen.findByText('Le texte alternatif est obligatoire.', { selector: 'p' }),
    ).toBeInTheDocument();
    await u.type(within(logoSection).getByLabelText(/Texte alternatif/), 'Logo de Garde Lagune');
    await u.click(within(logoSection).getByRole('button', { name: 'Envoyer l’image' }));
    expect(await screen.findByAltText('Logo de Garde Lagune')).toBeInTheDocument();
    expect(await screen.findByText(/Une seule image est autorisée/)).toBeInTheDocument();
  });

  it('affiche l’erreur 413 d’un envoi trop volumineux', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'uploadMedia').mockRejectedValue(
      new ApiError(413, 'Le fichier est trop volumineux.'),
    );
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Médias' }));
    const gallery = screen.getByRole('region', { name: /Galerie/ });
    await u.upload(
      within(gallery).getByLabelText(/Ajouter une image/),
      new File(['x'], 'g.png', { type: 'image/png' }),
    );
    await u.type(within(gallery).getByLabelText(/Texte alternatif/), 'Photo');
    await u.click(within(gallery).getByRole('button', { name: 'Envoyer l’image' }));
    expect(await screen.findByText('Le fichier est trop volumineux.')).toBeInTheDocument();
  });

  it('justificatifs : liste sans lien de téléchargement, envoi et suppression confirmée', async () => {
    const u = userEvent.setup();
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Justificatifs' }));
    expect(screen.getByText('extrait-rccm.pdf')).toBeInTheDocument();
    expect(screen.getByText(/stockés de façon privée/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await u.upload(
      screen.getByLabelText('Fichier'),
      new File(['%PDF'], 'agrement.pdf', { type: 'application/pdf' }),
    );
    await u.click(screen.getByRole('button', { name: 'Envoyer le justificatif' }));
    // Le nom s'affiche d'abord dans le champ fichier ; on attend la ligne de la liste envoyée.
    await u.click(
      await screen.findByRole('button', { name: 'Supprimer le justificatif agrement.pdf' }),
    );
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.queryByText('agrement.pdf')).not.toBeInTheDocument());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('modifications sensibles : une seule demande en attente, ancien → nouveau, annulation', async () => {
    const u = userEvent.setup();
    const create = vi.spyOn(clientApi, 'createChangeRequest');
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Modifications sensibles' }));
    // champs sensibles actuels en lecture seule
    expect(screen.getByText('CI-ABJ-2024-B-00301', { selector: 'dd' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('Modifiez au moins un champ avant d’envoyer la demande.', {
        selector: 'li',
      }),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    const rccm = screen.getByLabelText('Numéro RCCM');
    await u.clear(rccm);
    await u.type(rccm, 'CI-ABJ-2025-B-99999');
    await u.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByRole('heading', { name: 'Demande en attente' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith('provider', 'garde-lagune-securite', {
      rccm: 'CI-ABJ-2025-B-99999',
    });
    const pending = screen.getByRole('region', { name: 'Demande en attente' });
    expect(within(pending).getByText('CI-ABJ-2024-B-00301')).toBeInTheDocument();
    expect(within(pending).getByText('CI-ABJ-2025-B-99999')).toBeInTheDocument();
    // formulaire désactivé tant qu'une demande est en attente
    expect(screen.getByRole('button', { name: 'Envoyer la demande' })).toBeDisabled();
    expect(screen.getByLabelText('Numéro RCCM')).toBeDisabled();

    await u.click(screen.getByRole('button', { name: 'Annuler la demande' }));
    await u.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler la demande' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Demande en attente' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Envoyer la demande' })).toBeEnabled();
  });

  it('affiche le message de l’API sur un 409', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'createChangeRequest').mockRejectedValue(
      new ApiError(409, 'Une demande de modification est déjà en attente.'),
    );
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Modifications sensibles' }));
    const legal = screen.getByLabelText('Forme juridique');
    await chooseOption(u, legal, 'sas');
    await u.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('Une demande de modification est déjà en attente.'),
    ).toBeInTheDocument();
  });

  it('fiche introuvable : message explicite', async () => {
    manager('fiche-inexistante');
    expect(await screen.findByText('Introuvable')).toBeInTheDocument();
  });
});
