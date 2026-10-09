import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { ReferenceData } from '@/lib/api/types';

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

const SENSITIVE = ['name', 'rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number', 'force_type_id'];

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
    expect(screen.queryByRole('button', { name: 'Enregistrer les modifications' })).not.toBeInTheDocument();
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
    await u.selectOptions(screen.getAllByLabelText(/^Fonction/)[1]!, 'other');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les dirigeants' }));
    expect(await screen.findByText('Précisez la fonction.', { selector: 'p' })).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Intitulé de la fonction/), 'Directrice RH');
    await u.click(screen.getAllByLabelText(/Afficher ce dirigeant publiquement/)[1]!);
    await u.click(screen.getByRole('button', { name: 'Enregistrer les dirigeants' }));
    expect(await screen.findByText('La liste des dirigeants a été enregistrée.')).toBeInTheDocument();
    expect(patch.mock.calls[0]![2]).toEqual({
      executives: [
        { full_name: 'Yao Prestataire', position: 'general_manager', position_label: null, is_visible: true },
        { full_name: 'Awa Koné', position: 'other', position_label: 'Directrice RH', is_visible: true },
      ],
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
    expect(await screen.findByText('Le texte alternatif est obligatoire.', { selector: 'p' })).toBeInTheDocument();
    await u.type(within(logoSection).getByLabelText(/Texte alternatif/), 'Logo de Garde Lagune');
    await u.click(within(logoSection).getByRole('button', { name: 'Envoyer l’image' }));
    expect(await screen.findByAltText('Logo de Garde Lagune')).toBeInTheDocument();
    expect(await screen.findByText(/Une seule image est autorisée/)).toBeInTheDocument();
  });

  it('affiche l’erreur 413 d’un envoi trop volumineux', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'uploadMedia').mockRejectedValue(new ApiError(413, 'Le fichier est trop volumineux.'));
    manager('garde-lagune-securite');
    await u.click(await screen.findByRole('tab', { name: 'Médias' }));
    const gallery = screen.getByRole('region', { name: /Galerie/ });
    await u.upload(within(gallery).getByLabelText(/Ajouter une image/), new File(['x'], 'g.png', { type: 'image/png' }));
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
    await u.upload(screen.getByLabelText('Fichier'), new File(['%PDF'], 'agrement.pdf', { type: 'application/pdf' }));
    await u.click(screen.getByRole('button', { name: 'Envoyer le justificatif' }));
    expect(await screen.findByText('agrement.pdf')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Supprimer le justificatif agrement.pdf' }));
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
    expect(await screen.findByText('Modifiez au moins un champ avant d’envoyer la demande.', { selector: 'li' })).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    const rccm = screen.getByLabelText('Numéro RCCM');
    await u.clear(rccm);
    await u.type(rccm, 'CI-ABJ-2025-B-99999');
    await u.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByRole('heading', { name: 'Demande en attente' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith('provider', 'garde-lagune-securite', { rccm: 'CI-ABJ-2025-B-99999' });
    const pending = screen.getByRole('region', { name: 'Demande en attente' });
    expect(within(pending).getByText('CI-ABJ-2024-B-00301')).toBeInTheDocument();
    expect(within(pending).getByText('CI-ABJ-2025-B-99999')).toBeInTheDocument();
    // formulaire désactivé tant qu'une demande est en attente
    expect(screen.getByRole('button', { name: 'Envoyer la demande' })).toBeDisabled();
    expect(screen.getByLabelText('Numéro RCCM')).toBeDisabled();

    await u.click(screen.getByRole('button', { name: 'Annuler la demande' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler la demande' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Demande en attente' })).not.toBeInTheDocument());
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
    await u.clear(legal);
    await u.type(legal, 'SAS');
    await u.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByText('Une demande de modification est déjà en attente.')).toBeInTheDocument();
  });

  it('fiche introuvable : message explicite', async () => {
    manager('fiche-inexistante');
    expect(await screen.findByText('Introuvable')).toBeInTheDocument();
  });
});
