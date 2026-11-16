import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { AdminClaim, MyClaim } from '@/lib/api/claims';

const api = vi.hoisted(() => ({
  submitClaim: vi.fn(),
  listMyClaims: vi.fn(),
  findSimilarEstablishments: vi.fn(),
  adminListClaims: vi.fn(),
  adminGetClaim: vi.fn(),
  adminDownloadClaimDocument: vi.fn(),
  adminApproveClaim: vi.fn(),
  adminRejectClaim: vi.fn(),
  adminAssignOwner: vi.fn(),
}));
vi.mock('@/lib/api/claims', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/claims')>()),
  claimsApi: api,
}));

import { AdminClaimDetail } from '@/components/admin/revendications/AdminClaimDetail';
import { AdminClaimsView } from '@/components/admin/revendications/AdminClaimsView';
import { AssignOwnerPanel } from '@/components/admin/revendications/AssignOwnerPanel';
import { ClaimCallout } from '@/components/claims/ClaimCallout';
import { ClaimForm } from '@/components/claims/ClaimForm';
import { MyClaimsSection } from '@/components/claims/MyClaimsSection';
import { SimilarEstablishmentsWarning } from '@/components/claims/SimilarEstablishmentsWarning';
import { claimFormData } from '@/lib/api/claims';

const myClaim: MyClaim = {
  id: 5,
  status: 'pending',
  establishment: {
    type: 'provider',
    slug: 'vigie-telesurveillance',
    name: 'Vigie Télésurveillance',
  },
  rejection_reason: null,
  created_at: '2026-10-22T09:00:00Z',
  reviewed_at: null,
};

const adminClaim: AdminClaim = {
  id: 7,
  status: 'pending',
  establishment: {
    type: 'provider',
    id: 4,
    slug: 'vigie-telesurveillance',
    name: 'Vigie Télésurveillance',
    city: { name: 'Abidjan' },
  },
  user: { id: 21, name: 'Koffi Yao', email: 'koffi@example.test' },
  submitter_role: 'manager',
  phone: '+2250700000021',
  message: 'Je suis le gérant.',
  document: { name: 'rccm.pdf', mime_type: 'application/pdf', size_bytes: 2048 },
  rejection_reason: null,
  reviewer: null,
  created_at: '2026-10-22T09:00:00Z',
  reviewed_at: null,
};

const pdf = () => new File(['%PDF-1.4'], 'rccm.pdf', { type: 'application/pdf' });

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillValidForm(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByLabelText('Responsable ou dirigeant'));
  await u.type(screen.getByLabelText(/Téléphone/), '0709445111');
  await u.upload(screen.getByLabelText(/Justificatif/), pdf());
  await u.click(screen.getByRole('checkbox'));
}

describe('bloc de revendication public', () => {
  it('ne s’affiche que pour une fiche revendicable', () => {
    const { rerender } = render(
      <ClaimCallout type="provider" slug="vigie-telesurveillance" claimable={false} />,
    );
    expect(screen.queryByText(/C’est votre établissement/)).not.toBeInTheDocument();
    rerender(<ClaimCallout type="state_force" slug="brigade-x" claimable />);
    expect(screen.getByRole('link', { name: 'Revendiquer cette fiche' })).toHaveAttribute(
      'href',
      '/revendiquer/state_force/brigade-x',
    );
  });
});

/** Rend le formulaire et attend la fin de la lecture de /me/claims (R27). */
async function renderClaimForm() {
  render(<ClaimForm type="provider" slug="vigie-telesurveillance" name="Vigie" />);
  await screen.findByRole('button', { name: 'Envoyer ma demande' });
}

describe('formulaire de revendication', () => {
  beforeEach(() => {
    api.listMyClaims.mockResolvedValue([]);
  });

  it('demande déjà en cours : état affiché à la place du formulaire (R27)', async () => {
    api.listMyClaims.mockResolvedValue([myClaim]);
    render(<ClaimForm type="provider" slug="vigie-telesurveillance" name="Vigie" />);
    expect(
      await screen.findByRole('heading', { name: 'Demande de revendication en cours' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer ma demande' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Suivre mes revendications' })).toBeInTheDocument();
  });

  it('demande refusée ou sur une autre fiche : le formulaire reste proposé', async () => {
    api.listMyClaims.mockResolvedValue([
      { ...myClaim, status: 'rejected' },
      { ...myClaim, id: 6, establishment: { ...myClaim.establishment, slug: 'autre-fiche' } },
    ]);
    await renderClaimForm();
    expect(screen.queryByText('Demande de revendication en cours')).toBeNull();
  });

  it('échec de lecture des demandes : le formulaire reste proposé', async () => {
    api.listMyClaims.mockRejectedValue(new ApiError(500, 'Erreur'));
    await renderClaimForm();
  });

  it('signale les champs obligatoires sans appeler l’API', async () => {
    const u = userEvent.setup();
    await renderClaimForm();
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(api.submitClaim).not.toHaveBeenCalled();
    expect(screen.getByText('Indiquez votre qualité.')).toBeInTheDocument();
    expect(screen.getByText('Le numéro de téléphone est obligatoire.')).toBeInTheDocument();
    expect(screen.getByText('Joignez un justificatif.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    // Le focus est placé sur le premier champ en erreur.
    expect(screen.getByLabelText('Responsable ou dirigeant')).toHaveFocus();
  });

  it('refuse un fichier d’un format non accepté', async () => {
    const u = userEvent.setup({ applyAccept: false });
    await renderClaimForm();
    await u.upload(
      screen.getByLabelText(/Justificatif/),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    );
    expect(screen.getByText(/Format non accepté/)).toBeInTheDocument();
  });

  it('envoie la demande et affiche la confirmation', async () => {
    api.submitClaim.mockResolvedValue(myClaim);
    const u = userEvent.setup();
    await renderClaimForm();
    await fillValidForm(u);
    await u.type(screen.getByLabelText(/Message/), 'Je suis le gérant.');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    await waitFor(() => expect(api.submitClaim).toHaveBeenCalledTimes(1));
    const [type, slug, input] = api.submitClaim.mock.calls[0]!;
    expect(type).toBe('provider');
    expect(slug).toBe('vigie-telesurveillance');
    expect(input).toMatchObject({
      submitter_role: 'manager',
      phone: '0709445111',
      message: 'Je suis le gérant.',
      consent: true,
    });
    const heading = await screen.findByRole('heading', {
      name: 'Demande de revendication envoyée',
    });
    expect(heading).toHaveFocus();
  });

  it.each([
    [
      new ApiError(409, 'Cette fiche est déjà gérée par un compte.'),
      'Cette fiche est déjà gérée par un compte.',
    ],
    [
      new ApiError(409, 'Vous avez déjà une demande en cours pour cette fiche.'),
      'Vous avez déjà une demande en cours pour cette fiche.',
    ],
    [new ApiError(429, 'Too Many Attempts.'), /limite de demandes de revendication/],
  ])('affiche un message en français pour %s', async (error, expected) => {
    api.submitClaim.mockRejectedValue(error);
    const u = userEvent.setup();
    await renderClaimForm();
    await fillValidForm(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    const alert = await screen.findByRole('alert', {}, { timeout: 2000 });
    await waitFor(() => expect(within(alert).getByText(expected)).toBeInTheDocument());
  });

  it('relie les erreurs 422 de l’API aux champs', async () => {
    api.submitClaim.mockRejectedValue(
      new ApiError(422, 'Certaines informations sont invalides.', {
        document: ['Le justificatif doit être un PDF, un JPEG ou un PNG.'],
      }),
    );
    const u = userEvent.setup();
    await renderClaimForm();
    await fillValidForm(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(
      await screen.findByText('Le justificatif doit être un PDF, un JPEG ou un PNG.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Justificatif/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('construit un corps multipart conforme au contrat', () => {
    const fd = claimFormData({
      submitter_role: 'employee',
      phone: '07 09 44 51 11',
      message: '  ',
      document: pdf(),
      consent: true,
    });
    expect(fd.get('submitter_role')).toBe('employee');
    expect(fd.get('phone')).toBe('+2250709445111');
    expect(fd.has('message')).toBe(false);
    expect(fd.get('consent')).toBe('1');
    expect((fd.get('document') as File).name).toBe('rccm.pdf');
  });
});

describe('mes revendications', () => {
  it('liste les demandes avec leur statut et le motif de refus', async () => {
    api.listMyClaims.mockResolvedValue([
      myClaim,
      {
        ...myClaim,
        id: 6,
        status: 'rejected',
        rejection_reason: 'Justificatif illisible.',
        establishment: { type: 'state_force', slug: 'brigade-x', name: 'Brigade X' },
      },
    ]);
    render(<MyClaimsSection />);
    expect(await screen.findByRole('heading', { name: 'Mes revendications' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Brigade X' })).toHaveAttribute(
      'href',
      '/forces-etatiques/brigade-x',
    );
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Refusée')).toBeInTheDocument();
    expect(screen.getByText('Justificatif illisible.')).toBeInTheDocument();
  });

  it('reste masquée sans revendication', async () => {
    api.listMyClaims.mockResolvedValue([]);
    const { container } = render(<MyClaimsSection />);
    await waitFor(() => expect(api.listMyClaims).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('avertissement anti-doublon', () => {
  it('appelle l’API après une pause de saisie et propose de revendiquer', async () => {
    vi.useFakeTimers();
    try {
      api.findSimilarEstablishments.mockResolvedValue([
        {
          type: 'provider',
          slug: 'vigie-telesurveillance',
          name: 'Vigie Télésurveillance',
          city: { name: 'Abidjan' },
          is_claimable: true,
        },
        {
          type: 'provider',
          slug: 'vigie-plus',
          name: 'Vigie Plus',
          city: { name: 'Bouaké' },
          is_claimable: false,
        },
      ]);
      const { rerender } = render(<SimilarEstablishmentsWarning type="provider" name="Vi" />);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(api.findSimilarEstablishments).not.toHaveBeenCalled(); // moins de 3 caractères

      rerender(<SimilarEstablishmentsWarning type="provider" name="Vig" cityId="2" />);
      rerender(
        <SimilarEstablishmentsWarning type="provider" name="Vigie" cityId="2" phone="0709445111" />,
      );
      await act(async () => {
        vi.advanceTimersByTime(499);
      });
      expect(api.findSimilarEstablishments).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(api.findSimilarEstablishments).toHaveBeenCalledTimes(1);
      expect(api.findSimilarEstablishments.mock.calls[0]![0]).toEqual({
        type: 'provider',
        name: 'Vigie',
        city_id: '2',
        phone: '0709445111',
      });
    } finally {
      vi.useRealTimers();
    }
    expect(
      await screen.findByRole('heading', { name: 'Cette fiche existe peut-être déjà' }),
    ).toBeInTheDocument();
    const claim = screen.getAllByRole('link', { name: /Revendiquer/ });
    expect(claim).toHaveLength(1);
    expect(claim[0]).toHaveAttribute('href', '/revendiquer/provider/vigie-telesurveillance');
    expect(screen.getAllByRole('link', { name: /Voir la fiche/ })).toHaveLength(2);
  });

  it('n’affiche rien sans résultat ni en cas d’erreur', async () => {
    api.findSimilarEstablishments.mockRejectedValue(new ApiError(429, 'Trop de tentatives.'));
    const { container } = render(
      <SimilarEstablishmentsWarning type="state_force" name="Commissariat" debounceMs={0} />,
    );
    await waitFor(() => expect(api.findSimilarEstablishments).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });
});

describe('administration des revendications', () => {
  it('liste les demandes en attente et filtre par statut', async () => {
    api.adminListClaims.mockResolvedValue({
      data: [adminClaim],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      links: { next: null, prev: null },
    });
    render(<AdminClaimsView />);
    expect(await screen.findByRole('link', { name: 'Vigie Télésurveillance' })).toHaveAttribute(
      'href',
      '/admin/revendications/7',
    );
    expect(api.adminListClaims).toHaveBeenCalledWith({ status: 'pending', page: 1 });
    expect(screen.getByText(/Koffi Yao \(koffi@example.test\)/)).toBeInTheDocument();
  });

  it('accepte une demande après confirmation', async () => {
    api.adminGetClaim.mockResolvedValue(adminClaim);
    api.adminApproveClaim.mockResolvedValue({
      ...adminClaim,
      status: 'approved',
      reviewed_at: '2026-10-23T10:00:00Z',
      reviewer: { id: 1, name: 'Admin' },
    });
    const u = userEvent.setup();
    render(<AdminClaimDetail id={7} />);
    await u.click(await screen.findByRole('button', { name: 'Accepter' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/koffi@example.test/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Accepter' }));
    await waitFor(() => expect(api.adminApproveClaim).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Décision')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accepter' })).not.toBeInTheDocument();
  });

  it('affiche le conflit 409 dans la boîte de confirmation', async () => {
    api.adminGetClaim.mockResolvedValue(adminClaim);
    api.adminApproveClaim.mockRejectedValue(
      new ApiError(409, 'Cette fiche est déjà gérée par un compte.'),
    );
    const u = userEvent.setup();
    render(<AdminClaimDetail id={7} />);
    await u.click(await screen.findByRole('button', { name: 'Accepter' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Accepter' }));
    expect(
      await within(screen.getByRole('dialog')).findByText(
        'Cette fiche est déjà gérée par un compte.',
      ),
    ).toBeInTheDocument();
  });

  it('exige un motif d’au moins 10 caractères pour refuser', async () => {
    api.adminGetClaim.mockResolvedValue(adminClaim);
    api.adminRejectClaim.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<AdminClaimDetail id={7} />);
    await u.click(await screen.findByRole('button', { name: 'Refuser' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Refuser' });
    await u.type(within(dialog).getByLabelText(/Motif du refus/), 'Illisible');
    expect(submit).toBeDisabled();
    await u.type(within(dialog).getByLabelText(/Motif du refus/), ' : renvoyez-le');
    await u.click(submit);
    await waitFor(() =>
      expect(api.adminRejectClaim).toHaveBeenCalledWith(7, 'Illisible : renvoyez-le'),
    );
  });

  it('télécharge le justificatif', async () => {
    api.adminGetClaim.mockResolvedValue(adminClaim);
    api.adminDownloadClaimDocument.mockResolvedValue(new Blob(['%PDF']));
    const createUrl = vi.fn(() => 'blob:justificatif');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<AdminClaimDetail id={7} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le justificatif' }));
    await waitFor(() => expect(api.adminDownloadClaimDocument).toHaveBeenCalledWith(7));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});

describe('attribution d’une fiche à un compte', () => {
  it('confirme puis attribue la fiche', async () => {
    const onAssigned = vi.fn();
    api.adminAssignOwner.mockResolvedValue({ id: 4, name: 'Vigie' });
    const u = userEvent.setup();
    render(<AssignOwnerPanel type="provider" id={4} name="Vigie" onAssigned={onAssigned} />);
    await u.click(screen.getByRole('button', { name: 'Attribuer' }));
    expect(screen.getByText('Saisissez l’adresse e-mail du compte.')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Adresse e-mail du compte/), 'awa@example.test');
    await u.click(screen.getByRole('button', { name: 'Attribuer' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('awa@example.test')).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Attribuer' }));
    await waitFor(() =>
      expect(api.adminAssignOwner).toHaveBeenCalledWith('provider', 4, 'awa@example.test'),
    );
    expect(onAssigned).toHaveBeenCalled();
  });

  it('affiche sous le champ l’erreur « aucun compte actif »', async () => {
    api.adminAssignOwner.mockRejectedValue(
      new ApiError(422, 'Aucun compte actif avec cet e-mail.', {
        email: ['Aucun compte actif avec cet e-mail.'],
      }),
    );
    const u = userEvent.setup();
    render(<AssignOwnerPanel type="state_force" id={2} name="Brigade" onAssigned={vi.fn()} />);
    await u.type(screen.getByLabelText(/Adresse e-mail du compte/), 'inconnu@example.test');
    await u.click(screen.getByRole('button', { name: 'Attribuer' }));
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Attribuer' }));
    expect(await screen.findByText('Aucun compte actif avec cet e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse e-mail du compte/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
