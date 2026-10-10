import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

type Sess = { user: { email_verified: boolean } | null; status: 'loading' | 'anonymous' | 'authenticated' };
let session: Sess = { user: { email_verified: true }, status: 'authenticated' };
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));

let impl: () => Promise<unknown> = async () => ({});
const createReview = vi.fn((...args: unknown[]) => {
  void args;
  return impl();
});
vi.mock('@/lib/api/client', () => ({
  clientApi: { createReview: (...a: unknown[]) => createReview(...a) },
}));

import { ReviewForm } from '@/components/reviews/ReviewForm';

const BODY = 'Service rapide et agents très professionnels.';

async function fillAndSubmit(u: ReturnType<typeof userEvent.setup>, rate = true) {
  if (rate) await u.click(screen.getByRole('radio', { name: '4 sur 5' }));
  await u.type(screen.getByLabelText('Votre avis', { exact: false, selector: 'textarea' }), BODY);
  await u.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
}

describe('ReviewForm', () => {
  beforeEach(() => {
    createReview.mockClear();
    impl = async () => ({});
    session = { user: { email_verified: true }, status: 'authenticated' };
  });

  it('chargement : indicateur de session, pas de formulaire', () => {
    session = { user: null, status: 'loading' };
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    expect(screen.getByRole('status')).toHaveTextContent('Vérification de votre session');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('anonyme : invitation avec retour à la fiche', () => {
    session = { user: null, status: 'anonymous' };
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion?redirect=%2Fannuaire%2Fagence-x',
    );
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('non vérifié : message et lien vers le compte', () => {
    session = { user: { email_verified: false }, status: 'authenticated' };
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    expect(screen.getByText(/Vérifiez votre adresse e-mail/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à mon compte' })).toHaveAttribute('href', '/compte');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('étoiles : groupe radio navigable au clavier, valeur en texte', async () => {
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    expect(screen.getByRole('radiogroup', { name: /Votre note/ })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('Aucune note choisie')).toBeInTheDocument();
    await u.tab(); // premier radio du groupe (tabIndex 0, les autres hors tabulation)
    const first = screen.getByRole('radio', { name: '1 sur 5' });
    expect(first).toHaveFocus();
    await u.keyboard('{ArrowRight}{ArrowRight}');
    const third = screen.getByRole('radio', { name: '3 sur 5' });
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('3 sur 5')).toBeInTheDocument();
    await u.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '5 sur 5' })).toHaveAttribute('aria-checked', 'true');
  });

  it('validation : note et texte requis, aucun appel', async () => {
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await u.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    expect(await screen.findByText('Choisissez une note de 1 à 5.')).toBeInTheDocument();
    expect(screen.getByText(/au moins 10 caractères/)).toBeInTheDocument();
    expect(createReview).not.toHaveBeenCalled();
  });

  it('compteur de caractères en zone polie', async () => {
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    const counter = screen.getByText('0 / 3000 caractères');
    expect(counter).toHaveAttribute('aria-live', 'polite');
    await u.type(screen.getByLabelText(/Votre avis/, { selector: 'textarea' }), 'abcde');
    expect(screen.getByText('5 / 3000 caractères')).toBeInTheDocument();
  });

  it('succès : message de modération et lien vers mon avis', async () => {
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await u.type(screen.getByLabelText(/Titre/), '  Très bien ');
    await fillAndSubmit(u);
    expect(
      await screen.findByText('Merci ! Votre avis sera publié après modération.'),
    ).toBeInTheDocument();
    expect(createReview).toHaveBeenCalledWith('agence-x', {
      rating: 4,
      title: 'Très bien',
      body: BODY,
    });
    expect(screen.getByRole('link', { name: 'Voir mon avis' })).toHaveAttribute(
      'href',
      '/compte/mes-avis',
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Donner votre avis' })).toHaveFocus());
  });

  it('409 : avis déjà donné avec lien', async () => {
    impl = async () => {
      throw new ApiError(409, 'Vous avez déjà donné un avis pour ce prestataire.');
    };
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await fillAndSubmit(u);
    expect(
      await screen.findByText('Vous avez déjà donné un avis pour ce prestataire.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir mon avis' })).toBeInTheDocument();
  });

  it('403 propriétaire : message du serveur affiché', async () => {
    impl = async () => {
      throw new ApiError(403, 'Vous ne pouvez pas noter votre propre fiche.');
    };
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await fillAndSubmit(u);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous ne pouvez pas noter votre propre fiche.',
    );
    expect(screen.getByRole('button', { name: 'Envoyer mon avis' })).toBeEnabled();
  });

  it('404 : fiche indisponible', async () => {
    impl = async () => {
      throw new ApiError(404, 'Introuvable');
    };
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await fillAndSubmit(u);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette fiche n’est plus disponible');
  });

  it('422 : erreurs par champ', async () => {
    impl = async () => {
      throw new ApiError(422, 'Invalide', { body: ['Le texte contient un terme interdit.'] });
    };
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await fillAndSubmit(u);
    expect(await screen.findByText('Le texte contient un terme interdit.')).toBeInTheDocument();
  });

  it('429 : délai indiqué', async () => {
    impl = async () => {
      throw new ApiError(429, 'Trop', {}, 120);
    };
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await fillAndSubmit(u);
    expect(await screen.findByRole('alert')).toHaveTextContent('2 minutes');
  });

  it('double clic : un seul appel, bouton désactivé pendant l’envoi', async () => {
    let release: () => void = () => undefined;
    impl = () => new Promise((r) => (release = () => r({})));
    const u = userEvent.setup();
    render(<ReviewForm slug="agence-x" providerName="Agence X" />);
    await u.click(screen.getByRole('radio', { name: '5 sur 5' }));
    await u.type(screen.getByLabelText(/Votre avis/, { selector: 'textarea' }), BODY);
    const btn = screen.getByRole('button', { name: 'Envoyer mon avis' });
    await u.dblClick(btn);
    expect(createReview).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
    release();
    await screen.findByText(/Merci !/);
  });
});
