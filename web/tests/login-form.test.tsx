import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

let impl: () => Promise<unknown> = async () => ({ kind: 'two_factor' });
let sessionStatus = 'anonymous';
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/client', () => ({ clientApi: { login: () => impl() } }));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ setUser: vi.fn(), status: sessionStatus }),
}));

import { LoginForm } from '@/components/auth/LoginForm';

async function submit() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText(/Adresse e-mail/), 'a@example.test');
  await u.type(screen.getByLabelText(/Mot de passe/), 'motdepasse12');
  await u.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginForm : 403', () => {
  beforeEach(() => {
    impl = async () => ({ kind: 'two_factor' });
    sessionStatus = 'anonymous';
    router.replace.mockClear();
  });

  it('redirige un utilisateur déjà connecté vers la destination (R32)', () => {
    sessionStatus = 'authenticated';
    render(<LoginForm redirect="/compte/mes-avis" />);
    expect(router.replace).toHaveBeenCalledWith('/compte/mes-avis');
  });

  it('un visiteur voit le formulaire sans redirection', () => {
    render(<LoginForm />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('affiche le rappel « nouveau lien » seulement pour le code email_unverified', async () => {
    impl = async () => {
      throw new ApiError(
        403,
        'Veuillez confirmer votre adresse e-mail.',
        {},
        null,
        'email_unverified',
      );
    };
    render(<LoginForm />);
    await submit();
    expect(
      await screen.findByText(/nouveau lien de confirmation vient d’être envoyé/),
    ).toBeInTheDocument();
    // Un seul message (R30) : le message générique de l'API n'est pas affiché en plus.
    expect(screen.queryByText('Veuillez confirmer votre adresse e-mail.')).not.toBeInTheDocument();
  });

  it('un autre 403 affiche seulement le message de l’API', async () => {
    impl = async () => {
      throw new ApiError(403, 'Compte suspendu.');
    };
    render(<LoginForm />);
    await submit();
    expect(await screen.findByText('Compte suspendu.')).toBeInTheDocument();
    expect(screen.queryByText(/nouveau lien de confirmation/)).not.toBeInTheDocument();
  });

  it('affiche les bandeaux ?verified=0 et ?verified=1', () => {
    const { unmount } = render(<LoginForm verified="0" />);
    expect(screen.getByText(/Lien invalide ou expiré/)).toBeInTheDocument();
    unmount();
    render(<LoginForm verified="1" />);
    expect(screen.getByText(/Adresse e-mail confirmée/)).toBeInTheDocument();
  });
});
