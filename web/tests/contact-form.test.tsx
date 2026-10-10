import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const sendContact = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: { sendContact: (...args: unknown[]) => sendContact(...args) },
}));

import { ContactForm } from '@/components/contact/ContactForm';
import ContactPage from '@/app/contact/page';

async function fill(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText(/^Nom/), 'Awa Koné');
  await u.type(screen.getByLabelText(/Adresse e-mail/), 'awa@example.test');
  await u.type(screen.getByLabelText(/^Objet/), 'Question sur un prestataire');
  await u.type(screen.getByLabelText(/^Message/), 'Bonjour, je souhaite un renseignement.');
  await u.click(screen.getByLabelText(/J’accepte/));
}
const submit = (u: ReturnType<typeof userEvent.setup>) =>
  u.click(screen.getByRole('button', { name: 'Envoyer le message' }));

describe('ContactForm', () => {
  beforeEach(() => {
    sendContact.mockReset();
    sendContact.mockResolvedValue('Merci, votre message a bien été envoyé.');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.turnstile;
  });

  it('affiche les champs étiquetés', () => {
    render(<ContactForm />);
    for (const l of [/^Nom/, /Adresse e-mail/, /^Objet/, /^Message/, /J’accepte/]) {
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');
  });

  it('valide les champs requis et les bornes', async () => {
    const u = userEvent.setup();
    render(<ContactForm />);
    await submit(u);
    expect((await screen.findAllByText('Le nom est requis.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L’objet est requis.').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/^Objet/), { target: { value: 'o'.repeat(201) } });
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'court' } });
    await submit(u);
    expect((await screen.findAllByText('L’objet ne doit pas dépasser 200 caractères.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/au moins 10 caractères/).length).toBeGreaterThan(0);
    expect(screen.getByText(/5 \/ 5000/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'm'.repeat(5001) } });
    await submit(u);
    expect((await screen.findAllByText(/ne doit pas dépasser 5000 caractères/)).length).toBeGreaterThan(0);
    expect(sendContact).not.toHaveBeenCalled();
  });

  it('envoie le corps exact et affiche une confirmation focalisée', async () => {
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    await submit(u);
    const status = await screen.findByText('Merci, votre message a bien été envoyé.');
    await waitFor(() => expect(status.closest('[role="status"]')).toHaveFocus());
    expect(sendContact.mock.calls[0]![0]).toEqual({
      name: 'Awa Koné',
      email: 'awa@example.test',
      subject: 'Question sur un prestataire',
      message: 'Bonjour, je souhaite un renseignement.',
      consent: true,
      company_website: '',
    });
    await u.click(screen.getByRole('button', { name: 'Envoyer un autre message' }));
    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeInTheDocument();
  });

  it('n’interprète pas le texte du serveur comme du HTML', async () => {
    sendContact.mockResolvedValue('<i>Merci</i>');
    const u = userEvent.setup();
    const { container } = render(<ContactForm />);
    await fill(u);
    await submit(u);
    expect(await screen.findByText('<i>Merci</i>')).toBeInTheDocument();
    expect(container.querySelector('i')).toBeNull();
  });

  it('mappe le 422 serveur', async () => {
    sendContact.mockRejectedValue(new ApiError(422, 'Invalide', { subject: ['Objet refusé.'] }));
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    await submit(u);
    expect((await screen.findAllByText('Objet refusé.')).length).toBeGreaterThan(0);
  });

  it('gère le 429 puis réutilise l’Idempotency-Key', async () => {
    sendContact.mockRejectedValueOnce(new ApiError(429, 'Trop', {}, 30));
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    await submit(u);
    expect(await screen.findByText(/Réessayez dans 30 secondes/)).toBeInTheDocument();
    await submit(u);
    await screen.findByText('Merci, votre message a bien été envoyé.');
    expect(sendContact.mock.calls[1]![1]).toBe(sendContact.mock.calls[0]![1]);
  });

  it('un double clic ne produit qu’un seul appel', async () => {
    let resolve!: (v: unknown) => void;
    sendContact.mockReturnValue(new Promise((r) => (resolve = r)));
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    await u.dblClick(screen.getByRole('button', { name: 'Envoyer le message' }));
    expect(sendContact).toHaveBeenCalledTimes(1);
    await act(async () => resolve('Merci.'));
    await screen.findByText('Merci.');
  });

  it('transmet le champ piège rempli', async () => {
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    fireEvent.change(screen.getByLabelText('Ne pas remplir ce champ'), { target: { value: 'spam' } });
    await submit(u);
    await screen.findByText('Merci, votre message a bien été envoyé.');
    expect(sendContact.mock.calls[0]![0].company_website).toBe('spam');
  });

  it('Turnstile désactivé : aucun widget ; activé : jeton exigé puis transmis', async () => {
    const { unmount } = render(<ContactForm />);
    expect(screen.queryByTestId('turnstile')).toBeNull();
    unmount();

    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test');
    let opts: { callback: (t: string) => void } | undefined;
    window.turnstile = {
      render: (_el: HTMLElement, o: { callback: (t: string) => void }) => {
        opts = o;
        return 'w1';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    } as unknown as NonNullable<typeof window.turnstile>;
    const u = userEvent.setup();
    render(<ContactForm />);
    await fill(u);
    await waitFor(() => expect(opts).toBeDefined());
    await submit(u);
    expect(await screen.findByText(/vérification anti-robot avant/)).toBeInTheDocument();
    expect(sendContact).not.toHaveBeenCalled();
    act(() => opts!.callback('jeton-ok'));
    await submit(u);
    await screen.findByText('Merci, votre message a bien été envoyé.');
    expect(sendContact.mock.calls[0]![0].turnstile_token).toBe('jeton-ok');
  });
});

describe('Page Contact', () => {
  it('affiche les coordonnées avec liens tel: et mailto:', () => {
    render(<ContactPage />);
    expect(screen.getByRole('link', { name: '+225 07 09 44 51 11' })).toHaveAttribute('href', 'tel:+2250709445111');
    expect(screen.getByRole('link', { name: 'info@protectici.ci' })).toHaveAttribute('href', 'mailto:info@protectici.ci');
    expect(screen.getByText('Abidjan Plateau, immeuble Eden')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Contact' })).toBeInTheDocument();
  });
});
