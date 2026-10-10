import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { referenceData } from '@/lib/mocks/reference';
import { todayIso } from '@/lib/wave-b-schemas';

const createQuote = vi.fn();
const listProviders = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    createQuoteRequest: (...args: unknown[]) => createQuote(...args),
    listProviders: (...args: unknown[]) => listProviders(...args),
  },
}));

import { QuoteForm } from '@/components/quote/QuoteForm';

const DESCRIPTION = 'Gardiennage de nuit pour un entrepôt de 2 000 m² à Yopougon.';
const service = referenceData.service_types[0]!;
const abidjan = referenceData.cities.find((c) => c.name === 'Abidjan')!;
const bouake = referenceData.cities.find((c) => c.name === 'Bouaké')!;

function summary(i: number) {
  return { slug: `prestataire-${i}`, name: `Prestataire ${i}`, city: { name: 'Abidjan', slug: 'abidjan' } };
}

async function fillRequired(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText(/Prénom/), 'Awa');
  await u.type(screen.getByLabelText(/^Nom/), 'Koné');
  await u.type(screen.getByLabelText(/Adresse e-mail/), 'awa@example.test');
  await u.type(screen.getByLabelText(/^Téléphone/), '+225 07 00 00 00 00');
  await u.selectOptions(screen.getByLabelText(/Service recherché/), String(service.id));
  await u.selectOptions(screen.getByLabelText(/^Ville/), String(abidjan.id));
  await u.type(screen.getByLabelText(/Description de votre besoin/), DESCRIPTION);
  await u.click(screen.getByLabelText(/J’accepte/));
}

const submit = (u: ReturnType<typeof userEvent.setup>) =>
  u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

describe('QuoteForm', () => {
  beforeEach(() => {
    createQuote.mockReset();
    listProviders.mockReset();
    createQuote.mockResolvedValue({ reference: 'DEV-2026-000123', message: 'Merci, votre demande est enregistrée.' });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.turnstile;
  });

  it('affiche les sections et les champs étiquetés', () => {
    render(<QuoteForm reference={referenceData} />);
    for (const t of ['Vos coordonnées', 'Votre besoin', 'Prestataires souhaités', 'Consentement']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    }
    for (const l of [/Prénom/, /Adresse e-mail/, /^Téléphone/, /Entreprise/, /Service recherché/, /^Ville/, /Quartier/, /Description de votre besoin/, /Date de début/, /Budget indicatif/]) {
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');
    expect(screen.getByLabelText(/Date de début/)).toHaveAttribute('min', todayIso());
  });

  it('exige les champs requis et ne fait aucun appel', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await submit(u);
    expect(await screen.findAllByText('Le prénom est requis.')).toHaveLength(2); // résumé + champ
    expect(screen.getAllByText('Choisissez un service.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Choisissez une ville.').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vous devez accepter le traitement/).length).toBeGreaterThan(0);
    expect(screen.getByText(/champs sont à corriger/).closest('[tabindex="-1"]')).toHaveFocus();
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('refuse une description trop courte ou trop longue', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    const area = screen.getByLabelText(/Description de votre besoin/);
    await u.clear(area);
    await u.type(area, 'Trop court');
    expect(screen.getByText(/10 \/ 3000/)).toBeInTheDocument();
    await submit(u);
    expect(await screen.findAllByText(/au moins 20 caractères/)).not.toHaveLength(0);
    fireEvent.change(area, { target: { value: 'a'.repeat(3001) } });
    await submit(u);
    expect((await screen.findAllByText(/ne doit pas dépasser 3000 caractères/)).length).toBeGreaterThan(0);
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('refuse une date passée et un budget trop long', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    fireEvent.change(screen.getByLabelText(/Date de début/), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText(/Budget indicatif/), { target: { value: 'x'.repeat(51) } });
    await submit(u);
    expect((await screen.findAllByText('La date souhaitée ne peut pas être passée.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Le budget est trop long/).length).toBeGreaterThan(0);
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('filtre les quartiers selon la ville choisie', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    const district = screen.getByLabelText(/Quartier/);
    expect(district).toBeDisabled();
    await u.selectOptions(screen.getByLabelText(/^Ville/), String(abidjan.id));
    expect(within(screen.getByLabelText(/Quartier/)).getByRole('option', { name: 'Cocody' })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText(/^Ville/), String(bouake.id));
    const after = screen.getByLabelText(/Quartier/);
    expect(within(after).queryByRole('option', { name: 'Cocody' })).toBeNull();
    expect(within(after).getByRole('option', { name: 'Air France' })).toBeInTheDocument();
  });

  it('préremplit le prestataire reçu en prop', () => {
    render(<QuoteForm reference={referenceData} initialProvider={{ slug: 'sentinelle-securite-abidjan', name: 'Sentinelle Sécurité Abidjan' }} />);
    expect(screen.getByText('Prestataires choisis (1/5)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer Sentinelle Sécurité Abidjan' })).toBeInTheDocument();
  });

  it('empêche de choisir plus de 5 prestataires', async () => {
    const u = userEvent.setup();
    listProviders.mockResolvedValue({ data: [1, 2, 3, 4, 5, 6, 7].map(summary) });
    render(<QuoteForm reference={referenceData} />);
    await u.type(screen.getByLabelText('Rechercher un prestataire'), 'presta');
    await u.click(screen.getByRole('button', { name: 'Rechercher' }));
    for (let i = 1; i <= 5; i++) await u.click(await screen.findByRole('button', { name: `Choisir : Prestataire ${i}` }));
    expect(screen.getByText('Prestataires choisis (5/5)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choisir : Prestataire 6' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choisir : Prestataire 7' })).toBeDisabled();
  });

  it('envoie le corps exact puis affiche la confirmation avec la référence copiable', async () => {
    const u = userEvent.setup();
    render(
      <QuoteForm
        reference={referenceData}
        initialProvider={{ slug: 'sentinelle-securite-abidjan', name: 'Sentinelle Sécurité Abidjan' }}
      />,
    );
    await fillRequired(u);
    await submit(u);
    const title = await screen.findByRole('heading', { name: /demande de devis a bien été envoyée/ });
    await waitFor(() => expect(title).toHaveFocus());
    expect(createQuote).toHaveBeenCalledTimes(1);
    const [body, key] = createQuote.mock.calls[0]!;
    expect(body).toEqual({
      first_name: 'Awa',
      last_name: 'Koné',
      email: 'awa@example.test',
      phone: '+225 07 00 00 00 00',
      service_type_id: service.id,
      city_id: abidjan.id,
      description: DESCRIPTION,
      provider_slugs: ['sentinelle-securite-abidjan'],
      consent: true,
      company_website: '',
    });
    expect(typeof key).toBe('string');
    expect(screen.getByTestId('reference')).toHaveTextContent('DEV-2026-000123');
    expect(screen.getByText(/transmise aux prestataires choisis/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parcourir l’annuaire' })).toHaveAttribute('href', '/annuaire');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await u.click(screen.getByRole('button', { name: 'Copier la référence' }));
    expect(writeText).toHaveBeenCalledWith('DEV-2026-000123');
    expect(await screen.findByText('Référence copiée.')).toBeInTheDocument();
  });

  it('précise que l’équipe achemine la demande quand aucun prestataire n’est choisi, et permet une autre demande', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    await u.selectOptions(screen.getByLabelText(/Quartier/), String(abidjan.districts[0]!.id));
    await submit(u);
    await screen.findByTestId('reference');
    expect(createQuote.mock.calls[0]![0]).not.toHaveProperty('provider_slugs');
    expect(createQuote.mock.calls[0]![0].district_id).toBe(abidjan.districts[0]!.id);
    expect(screen.getByText(/examinée par notre équipe/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Faire une autre demande' }));
    expect(screen.getByRole('button', { name: 'Envoyer ma demande' })).toBeInTheDocument();
  });

  it('n’interprète pas le texte du serveur comme du HTML', async () => {
    createQuote.mockResolvedValue({ reference: 'DEV-2026-000124', message: '<b>Gras</b> <img src=x onerror=alert(1)>' });
    const u = userEvent.setup();
    const { container } = render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    await submit(u);
    await screen.findByTestId('reference');
    expect(screen.getByText(/<b>Gras<\/b>/)).toBeInTheDocument();
    expect(container.querySelector('b, img')).toBeNull();
  });

  it('mappe le 422 serveur aux champs', async () => {
    createQuote.mockRejectedValue(new ApiError(422, 'Invalide', { email: ['Cette adresse est refusée.'], 'provider_slugs.0': ['Prestataire indisponible.'] }));
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    await submit(u);
    expect((await screen.findAllByText('Cette adresse est refusée.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prestataire indisponible.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Adresse e-mail/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('affiche le délai du 429 et réutilise la même Idempotency-Key au second essai', async () => {
    createQuote.mockRejectedValueOnce(new ApiError(429, 'Trop', {}, 120));
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    await submit(u);
    expect(await screen.findByText(/Réessayez dans 2 minutes/)).toBeInTheDocument();
    await submit(u);
    await screen.findByTestId('reference');
    expect(createQuote).toHaveBeenCalledTimes(2);
    expect(createQuote.mock.calls[1]![1]).toBe(createQuote.mock.calls[0]![1]);
  });

  it('régénère la clé quand les données changent', async () => {
    createQuote.mockRejectedValueOnce(new ApiError(500, 'Erreur'));
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    await submit(u);
    await screen.findByRole('alert', {}).catch(() => null);
    await waitFor(() => expect(createQuote).toHaveBeenCalledTimes(1));
    await u.type(screen.getByLabelText(/Entreprise/), 'Ma société');
    await submit(u);
    await waitFor(() => expect(createQuote).toHaveBeenCalledTimes(2));
    expect(createQuote.mock.calls[1]![1]).not.toBe(createQuote.mock.calls[0]![1]);
  });

  it('un double clic ne produit qu’un seul appel', async () => {
    let resolve!: (v: unknown) => void;
    createQuote.mockReturnValue(new Promise((r) => (resolve = r)));
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    const btn = screen.getByRole('button', { name: 'Envoyer ma demande' });
    await u.dblClick(btn);
    expect(createQuote).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
    await act(async () => resolve({ reference: 'DEV-2026-000125', message: 'Merci.' }));
    await screen.findByTestId('reference');
  });

  it('transmet le champ piège rempli tel quel', async () => {
    const u = userEvent.setup();
    render(<QuoteForm reference={referenceData} />);
    await fillRequired(u);
    fireEvent.change(screen.getByLabelText('Ne pas remplir ce champ'), { target: { value: 'http://spam.test' } });
    await submit(u);
    await screen.findByTestId('reference');
    expect(createQuote.mock.calls[0]![0].company_website).toBe('http://spam.test');
  });

  it('n’affiche pas Turnstile quand il est désactivé', () => {
    render(<QuoteForm reference={referenceData} />);
    expect(screen.queryByTestId('turnstile')).toBeNull();
  });

  it('exige le jeton Turnstile quand il est activé, puis l’envoie', async () => {
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
    render(<QuoteForm reference={referenceData} />);
    expect(screen.getByTestId('turnstile')).toBeInTheDocument();
    await fillRequired(u);
    await waitFor(() => expect(opts).toBeDefined());
    await submit(u);
    expect(await screen.findByText(/vérification anti-robot/)).toBeInTheDocument();
    expect(createQuote).not.toHaveBeenCalled();
    act(() => opts!.callback('jeton-ok'));
    await submit(u);
    await screen.findByTestId('reference');
    expect(createQuote.mock.calls[0]![0].turnstile_token).toBe('jeton-ok');
  });
});
