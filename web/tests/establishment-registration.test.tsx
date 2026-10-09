import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { EstablishmentCreateInput, ReferenceData } from '@/lib/api/types';

const session = vi.hoisted(() => ({
  value: {
    status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading',
    user: { email_verified: true } as unknown,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/inscription-etablissement',
}));
vi.mock('@/components/map/MapPicker', () => ({ MapPicker: () => null }));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ ...session.value, refresh: vi.fn(), setUser: vi.fn(), logout: vi.fn() }),
}));

type Registration = typeof import('@/components/establishment/EstablishmentRegistration').EstablishmentRegistration;
type RequireAuthT = typeof import('@/components/establishment/RequireAuth').RequireAuth;
let Registration: Registration;
let RequireAuth: RequireAuthT;
let clientApi: typeof import('@/lib/api/client').clientApi;
let reference: ReferenceData;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ({ clientApi } = await import('@/lib/api/client'));
  ({ EstablishmentRegistration: Registration } = await import(
    '@/components/establishment/EstablishmentRegistration'
  ));
  ({ RequireAuth } = await import('@/components/establishment/RequireAuth'));
  reference = await clientApi.getReferenceData();
  await clientApi.login({ email: 'prestataire@example.test', password: 'motdepasse' });
});

afterEach(() => vi.restoreAllMocks());

type User = ReturnType<typeof userEvent.setup>;

const next = (u: User) => u.click(screen.getByRole('button', { name: 'Suivant' }));

/** Parcourt les étapes jusqu'au récapitulatif (consentement coché). */
async function fillToReview(u: User, opts: { name?: string; doc?: boolean } = {}) {
  await u.click(screen.getByRole('radio', { name: /Prestataire privé/ }));
  await next(u);
  await u.click(screen.getByRole('radio', { name: 'Responsable ou dirigeant' }));
  await next(u);
  await u.type(screen.getByLabelText(/Raison sociale/), opts.name ?? 'Sentinelle du Plateau');
  await u.click(
    within(screen.getByRole('group', { name: /Type d’entreprise/ })).getByLabelText(
      reference.company_types[0]!.name,
    ),
  );
  await u.click(
    within(screen.getByRole('group', { name: /Services proposés/ })).getByLabelText(
      reference.service_types[0]!.name,
    ),
  );
  await next(u);
  await u.selectOptions(screen.getByLabelText(/Ville/), String(reference.cities[0]!.id));
  await next(u);
  await next(u); // légal (facultatif)
  await u.type(screen.getByLabelText(/^Téléphone/), '0709445111');
  await next(u);
  if (opts.doc) {
    await u.upload(
      screen.getByLabelText('Fichier à ajouter'),
      new File(['%PDF-1.4'], 'agrement.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText('agrement.pdf')).toBeInTheDocument();
  }
  await next(u);
  expect(screen.getByRole('heading', { name: 'Récapitulatif' })).toBeInTheDocument();
  await u.click(screen.getByLabelText(/J’atteste que ces informations/));
}

describe('inscription d’établissement', () => {
  it('invite un visiteur anonyme à se connecter', () => {
    session.value = { status: 'anonymous', user: null };
    render(
      <RequireAuth redirectTo="/inscription-etablissement" intro="Connectez-vous pour continuer.">
        <Registration reference={reference} />
      </RequireAuth>,
    );
    expect(screen.getByRole('heading', { name: 'Connexion requise' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?redirect=%2Finscription-etablissement',
    );
    expect(screen.queryByRole('button', { name: 'Suivant' })).not.toBeInTheDocument();
    session.value = { status: 'authenticated', user: { email_verified: true } };
  });

  it('valide chaque étape : erreur par champ et focus sur le résumé', async () => {
    const u = userEvent.setup();
    render(<Registration reference={reference} />);
    await next(u);
    const summary = (await screen.findByText('Un champ est à corriger :')).parentElement!;
    expect(within(summary).getByRole('link', { name: 'Choisissez le type d’établissement.' })).toBeInTheDocument();
    expect(summary).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Type d’établissement' })).toBeInTheDocument();
  });

  it('parcourt toutes les étapes jusqu’à la confirmation avec un justificatif', async () => {
    const u = userEvent.setup();
    const upload = vi.spyOn(clientApi, 'uploadDocument');
    render(<Registration reference={reference} />);
    await fillToReview(u, { doc: true });
    expect(screen.getByText('Sentinelle du Plateau')).toBeInTheDocument();
    expect(screen.getByText('+2250709445111')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(
      await screen.findByRole('heading', { name: /Demande reçue/ }, { timeout: 4000 }),
    ).toHaveFocus();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]![3]).toBe('rccm_extract');
    expect(screen.getByRole('link', { name: /Ouvrir mon espace prestataire/ })).toHaveAttribute(
      'href',
      '/espace-prestataire/provider/sentinelle-du-plateau',
    );
    expect(screen.getByRole('link', { name: 'Retour à l’annuaire' })).toHaveAttribute('href', '/annuaire');
    const list = await clientApi.listMyEstablishments(1);
    expect(list.data.some((e) => e.slug === 'sentinelle-du-plateau' && e.status === 'pending')).toBe(true);
  });

  it('rejouer avec la même clé d’idempotence ne crée qu’une seule fiche', async () => {
    const input: EstablishmentCreateInput = {
      type: 'provider',
      name: 'Rejeu Sécurité',
      company_type_ids: [reference.company_types[0]!.id],
      service_type_ids: [reference.service_types[0]!.id],
      phone: '+2250709445111',
      city_id: reference.cities[0]!.id,
      submitter_role: 'manager',
      is_in_service: true,
      consent: true,
    };
    const before = (await clientApi.listMyEstablishments(1)).meta.total;
    const a = await clientApi.createEstablishment(input, 'cle-de-test-1');
    const b = await clientApi.createEstablishment(input, 'cle-de-test-1');
    expect(b.slug).toBe(a.slug);
    expect((await clientApi.listMyEstablishments(1)).meta.total).toBe(before + 1);
  });

  it('conserve la clé après une erreur 503 puis la renvoie telle quelle', async () => {
    const u = userEvent.setup();
    const real = clientApi.createEstablishment.bind(clientApi);
    const spy = vi
      .spyOn(clientApi, 'createEstablishment')
      .mockRejectedValueOnce(new ApiError(503, 'Le service est momentanément indisponible.'))
      .mockImplementation(real);
    render(<Registration reference={reference} />);
    await fillToReview(u, { name: 'Clé Conservée SARL' });
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByText('Le service est momentanément indisponible.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Récapitulatif' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByRole('heading', { name: /Demande reçue/ }, { timeout: 4000 })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0]![1]).toBeTruthy();
    expect(spy.mock.calls[1]![1]).toBe(spy.mock.calls[0]![1]);
  });

  it('régénère la clé après un 422 et ramène à l’étape du champ fautif', async () => {
    const u = userEvent.setup();
    const real = clientApi.createEstablishment.bind(clientApi);
    const spy = vi
      .spyOn(clientApi, 'createEstablishment')
      .mockRejectedValueOnce(
        new ApiError(422, 'Certaines informations sont invalides.', { name: ['Ce nom est déjà utilisé.'] }),
      )
      .mockImplementation(real);
    render(<Registration reference={reference} />);
    await fillToReview(u, { name: 'Clé Régénérée SARL' });
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByRole('heading', { name: 'Identité' })).toBeInTheDocument();
    expect(screen.getByText('Ce nom est déjà utilisé.', { selector: 'p' })).toBeInTheDocument();
    for (let i = 0; i < 5; i++) await next(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(spy.mock.calls[1]![1]).not.toBe(spy.mock.calls[0]![1]);
  });

  it('signale un justificatif refusé alors que la fiche est créée', async () => {
    const u = userEvent.setup();
    vi.spyOn(clientApi, 'uploadDocument').mockRejectedValue(
      new ApiError(415, 'Ce type de fichier n’est pas accepté.'),
    );
    render(<Registration reference={reference} />);
    await fillToReview(u, { name: 'Justificatif Refusé SA', doc: true });
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByRole('heading', { name: /Demande reçue/ }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Un justificatif n’a pas pu être envoyé/)).toBeInTheDocument();
    expect(screen.getByText(/Ce type de fichier n’est pas accepté\./)).toBeInTheDocument();
  });
});
