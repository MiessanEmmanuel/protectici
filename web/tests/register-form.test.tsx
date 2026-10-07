import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

let impl: () => Promise<string> = async () => 'ok';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const register = vi.fn((..._args: unknown[]) => impl());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const resend = vi.fn(async (_email: string) => 'Message neutre du serveur.');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    register: (...args: unknown[]) => register(...args),
    resendVerificationPublic: (email: string) => resend(email),
  },
}));

import { RegisterForm } from '@/components/auth/RegisterForm';

async function fill() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText(/Prénom/), 'Awa');
  await u.type(screen.getByLabelText(/^Nom/), 'Koné');
  await u.type(screen.getByLabelText(/Adresse e-mail/), 'awa@example.test');
  await u.type(screen.getByLabelText(/^Mot de passe/), 'motdepasse12');
  await u.type(screen.getByLabelText(/Confirmer/), 'motdepasse12');
  await u.click(screen.getByLabelText(/J’accepte/));
  await u.click(screen.getByRole('button', { name: 'Créer mon compte' }));
  return u;
}

describe('RegisterForm', () => {
  beforeEach(() => {
    register.mockClear();
    resend.mockClear();
    impl = async () => 'ok';
  });

  it('affiche un écran neutre (jamais « compte créé »), focalisé, avec renvoi désactivé', async () => {
    render(<RegisterForm />);
    await fill();
    const title = await screen.findByRole('heading', { name: 'Vérifiez votre boîte e-mail' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(
      screen.getByText(/Si cette adresse est valide, vous allez recevoir un e-mail/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/compte a été créé|compte créé/i);
    expect(screen.getByRole('button', { name: /Renvoyer l’e-mail/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Aller à la connexion' })).toHaveAttribute(
      'href',
      '/connexion',
    );
  });

  it('affiche les erreurs 422 par champ', async () => {
    impl = async () => {
      throw new ApiError(422, 'Invalide', { password: ['Mot de passe trop faible.'] });
    };
    render(<RegisterForm />);
    await fill();
    expect(await screen.findByText('Mot de passe trop faible.')).toBeInTheDocument();
  });

  it('affiche le délai du 429', async () => {
    impl = async () => {
      throw new ApiError(429, 'Trop', {}, 120);
    };
    render(<RegisterForm />);
    await fill();
    expect(await screen.findByText(/Réessayez dans 2 minutes/)).toBeInTheDocument();
  });

  it('renvoie via l’endpoint public avec l’e-mail seul, après 60 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<RegisterForm />);
      const u = await fill();
      const btn = await screen.findByRole('button', { name: /Renvoyer l’e-mail/ });
      expect(btn).toBeDisabled();
      for (let i = 0; i < 61; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      await u.click(screen.getByRole('button', { name: 'Renvoyer l’e-mail' }));
      expect(resend).toHaveBeenCalledExactlyOnceWith('awa@example.test');
      expect(register).toHaveBeenCalledTimes(1); // pas de nouvelle inscription, pas de mot de passe renvoyé
      expect(await screen.findByText('Message neutre du serveur.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
