import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCsp } from '@/lib/csp';
import { AntiSpamFields } from '@/components/security/AntiSpamFields';
import { useAntiSpam } from '@/components/security/use-anti-spam';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const forgot = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    forgotPassword: (...args: unknown[]) => forgot(...args),
    register: vi.fn(async () => 'ok'),
    resendVerificationPublic: vi.fn(async () => 'ok'),
  },
}));

import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

function Probe({ onSubmit }: { onSubmit: (p: ReturnType<ReturnType<typeof useAntiSpam>['payload']>, ready: boolean) => void }) {
  const spam = useAntiSpam();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(spam.payload(), spam.ready);
      }}
    >
      <AntiSpamFields spam={spam} />
      <button type="submit">Envoyer</button>
    </form>
  );
}

describe('CSP et Turnstile', () => {
  it('sans clé : aucune origine Cloudflare dans la CSP', () => {
    const csp = buildCsp({ nonce: 'abc', isDev: false, apiOrigin: 'http://api.test' });
    expect(csp).not.toContain('challenges.cloudflare.com');
    expect(csp).not.toMatch(/frame-src/);
  });

  it('avec clé : script-src et frame-src autorisent Cloudflare, sans unsafe-inline ni unsafe-eval en production', () => {
    const csp = buildCsp({ nonce: 'abc', isDev: false, apiOrigin: 'http://api.test', turnstile: true });
    expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src https:\/\/challenges\.cloudflare\.com/);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });
});

describe('Honeypot et Turnstile (composants)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete window.turnstile;
    document.getElementById('cf-turnstile-script')?.remove();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.turnstile;
    document.getElementById('cf-turnstile-script')?.remove();
  });

  it('le champ piège est masqué aux technologies d’assistance, hors tabulation, sans autocomplétion', () => {
    render(<Probe onSubmit={() => {}} />);
    const trap = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    expect(trap).toBeTruthy();
    expect(trap.tabIndex).toBe(-1);
    expect(trap.getAttribute('autocomplete')).toBe('off');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap.value).toBe('');
  });

  it('Turnstile désactivé : rien n’est rendu, aucun script chargé, envoi autorisé', async () => {
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    expect(screen.queryByTestId('turnstile')).toBeNull();
    expect(document.getElementById('cf-turnstile-script')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).toHaveBeenCalledWith({ company_website: '' }, true);
  });

  it('Turnstile activé : charge le script, bloque tant que le jeton manque, puis transmet turnstile_token', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'cle-de-test');
    let callbacks: { callback: (t: string) => void; 'expired-callback': () => void } | null = null;
    window.turnstile = {
      render: vi.fn((_el, options) => {
        callbacks = options;
        return 'w1';
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const onSubmit = vi.fn();
    render(<Probe onSubmit={onSubmit} />);
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled());
    expect(screen.getByTestId('turnstile')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ company_website: '' }, false);

    act(() => callbacks!.callback('jeton-123'));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ turnstile_token: 'jeton-123', company_website: '' }, true);

    act(() => callbacks!['expired-callback']());
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onSubmit).toHaveBeenLastCalledWith({ company_website: '' }, false);
    expect(screen.getByRole('status')).toHaveTextContent(/expiré/i);
  });

  it('Turnstile activé, erreur de chargement : message accessible et bouton Relancer', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'cle-de-test');
    render(<Probe onSubmit={() => {}} />);
    const script = await waitFor(() => {
      const s = document.getElementById('cf-turnstile-script');
      expect(s).toBeTruthy();
      return s!;
    });
    expect(script.getAttribute('src')).toMatch(/^https:\/\/challenges\.cloudflare\.com\/turnstile\//);
    act(() => {
      script.dispatchEvent(new Event('error'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/vérification anti-robot a échoué/i);
    expect(screen.getByRole('button', { name: 'Relancer la vérification' })).toBeInTheDocument();
  });
});

describe('mot de passe oublié : antispam', () => {
  beforeEach(() => {
    forgot.mockClear();
    vi.unstubAllEnvs();
  });

  it('champ piège rempli : succès simulé identique, aucun appel API', async () => {
    const u = userEvent.setup();
    render(<ForgotPasswordForm />);
    await u.type(screen.getByLabelText(/Adresse e-mail/), 'a@example.test');
    const trap = document.querySelector('input[name="company_website"]') as HTMLInputElement;
    await u.type(trap, 'http://spam.example');
    await u.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(await screen.findByText(/Si un compte existe pour cette adresse/)).toBeInTheDocument();
    expect(forgot).not.toHaveBeenCalled();
  });

  it('Turnstile désactivé : l’appel part sans jeton', async () => {
    const u = userEvent.setup();
    render(<ForgotPasswordForm />);
    await u.type(screen.getByLabelText(/Adresse e-mail/), 'a@example.test');
    await u.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    await waitFor(() => expect(forgot).toHaveBeenCalledWith('a@example.test', undefined));
  });

  it('Turnstile activé sans jeton : envoi bloqué avec un message', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'cle-de-test');
    window.turnstile = { render: vi.fn(() => 'w'), reset: vi.fn(), remove: vi.fn() };
    const u = userEvent.setup();
    render(<ForgotPasswordForm />);
    await u.type(screen.getByLabelText(/Adresse e-mail/), 'a@example.test');
    await u.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(await screen.findByText(/terminer la vérification anti-robot/)).toBeInTheDocument();
    expect(forgot).not.toHaveBeenCalled();
    delete window.turnstile;
  });
});
