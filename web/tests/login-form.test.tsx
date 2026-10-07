import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

let impl: () => Promise<unknown> = async () => ({ kind: 'two_factor' });
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({ clientApi: { login: () => impl() } }));
vi.mock('@/components/layout/SessionProvider', () => ({
  useSession: () => ({ setUser: vi.fn() }),
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
    expect(await screen.findByText('Veuillez confirmer votre adresse e-mail.')).toBeInTheDocument();
    expect(
      screen.getByText(/nouveau lien de confirmation vient d’être envoyé/),
    ).toBeInTheDocument();
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
